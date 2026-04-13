# cf-todo

一个跑在Cloudflare Worker + D1上的待办网页，由AI设计

## 能干什么

- 增删改、标记完成
- 创建子任务拆分步骤，逐个勾掉
- 自动拉取B站/微博/知乎/百度热点共20个，当任务或灵感池用
- 每日重复事项，勾了明天还有
- 回收站防手滑
- 批量操作、筛选排序、导入导出

## 怎么部署

1. 创建D1数据库，名称、地区随便
2. 创建Worker，选择从Hello world开始
3. 绑定D1数据库，变量名 `DB`
4. 加两个环境变量：
   - `JWT_SECRET` ：随便填一串乱码
   - `ADMIN_PASSWORD` ：你的登录密码
5. 编辑Worker代码，直接复制粘贴，然后保存

## 使用方法

- 右下角 `+` 建任务，可填子任务、时间、优先级、链接、快捷复制内容
- 点任务看详情，点「编辑」修改
- 右上设置调整偏好、备份数据、清空重开
- 备注支持Markdown的加粗、斜体、删除线

## 截图

<div align="center">
  <img src="./Screenshots/Screenshots1.jpg" width="30%" />
  <img src="./Screenshots/Screenshots2.jpg" width="30%" />
  <img src="./Screenshots/Screenshots3.jpg" width="30%" />
</div>
<div align="center">
  <img src="./Screenshots/Screenshots4.jpg" width="30%" />
  <img src="./Screenshots/Screenshots5.jpg" width="30%" />
  <img src="./Screenshots/Screenshots6.jpg" width="30%" />
</div>
<div align="center">
  <img src="./Screenshots/Screenshots7.jpg" width="45%" />
  <img src="./Screenshots/Screenshots8.jpg" width="45%" />
</div>
