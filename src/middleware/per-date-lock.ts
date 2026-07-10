/**
 * cf-todo per-date 锁中间件
 *
 * _withV1TodosDateLock 合并为一个共享 Map。
 *
 *   原代码 V0 和 V1 是两个独立 Map（_todosDateChains / _v1TodosDateChains），
 *   导致同一日期的 V0 GET /api/todos?date=X 和 V1 GET /api/v1/todos?date=X
 *   互不串行，可能并发触发 RRULE 展开重复写入实例。
 *   合并为一个 Map 后，V0/V1 同日期请求共享同一锁链。
 *
 * 保留语义：
 *   - 仅同 isolate 内有效（跨 isolate 仍可能漏过，D1 层用 UNIQUE 约束兜底）
 *   - prev.then(fn, fn)：失败也继续，不阻塞后续请求
 *   - 5 秒 GC：tail 完成后延迟 5 秒清理 Map 条目，防 Map 无限增长
 *
 */

/**
 * 同 date 的请求串行化锁链。
 * key: date 字符串（YYYY-MM-DD）
 * value: 该 date 上一次请求的 tail Promise（用于 .then 链式串行）
 *
 * 类型说明：tail 是 .catch(() => {}) 的产物，理论上是 Promise<void>，
 * 但 prev.then(fn, fn) 返回 Promise<void | T>，catch 后仍是 Promise<void | T>。
 * 用 Promise<unknown> 放宽，避免泛型 T 噪音。
 */
const _todosDateChains = new Map<string, Promise<unknown>>();

/**
 * 在 date 维度串行执行 fn。
 *
 * 语义：
 *   - 同一 date 的多个 fn 调用会按顺序执行（前一个完成才开始下一个）
 *   - 不同 date 的 fn 并行执行
 *   - fn 抛错不会阻塞后续 fn（prev.then(fn, fn) 的容错语义）
 *
 * @param date YYYY-MM-DD 格式日期
 * @param fn 要串行执行的异步函数
 * @returns fn 的返回值 Promise
 */
export function withTodosDateLock<T>(date: string, fn: () => Promise<T>): Promise<T> {
  const prev = _todosDateChains.get(date) || Promise.resolve();
  // 失败也继续，不阻塞后续——与原代码 prev.then(fn, fn) 一致
  const next = prev.then(fn, fn);
  // tail 不抛错，避免链式 reject 传染
  const tail = next.catch(() => {});
  _todosDateChains.set(date, tail);
  // 5 秒后清理 Map 条目（如果 tail 仍是当前 tail，说明这 5 秒内没有新请求）
  tail.then(() => {
    setTimeout(() => {
      if (_todosDateChains.get(date) === tail) {
        _todosDateChains.delete(date);
      }
    }, 5000);
  });
  return next;
}

/**
 * 测试辅助：清空所有锁链。
 * 仅用于 vitest 单元测试，生产代码不应调用。
 */
export function _clearTodosDateLocksForTest(): void {
  _todosDateChains.clear();
}

/**
 * 测试辅助：获取当前锁链数量。
 * 仅用于 vitest 单元测试，生产代码不应调用。
 */
export function _getTodosDateLockCountForTest(): number {
  return _todosDateChains.size;
}
