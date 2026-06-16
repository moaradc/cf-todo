export const router = `
    // ==================== SPA Router ====================
    var _navStack = [];
    var _popSkip = 0;
    var _isNavClosing = false;

    function _navPush(id, closeFn, path) {
      _navStack.push({ id: id, closeFn: closeFn });
      history.pushState({ _nav: true }, '', path);
    }

    function _navClose(id) {
      if (_isNavClosing) return;
      var idx = -1;
      for (var i = _navStack.length - 1; i >= 0; i--) {
        if (_navStack[i].id === id) { idx = i; break; }
      }
      if (idx === -1) return;
      var count = _navStack.length - idx;
      var items = _navStack.splice(idx);
      _isNavClosing = true;
      for (var j = items.length - 1; j >= 0; j--) {
        items[j].closeFn();
      }
      _isNavClosing = false;
      if (count > 0) {
        _popSkip = count;
        history.go(-count);
      }
    }

    function _navBack() {
      if (_navStack.length === 0) return;
      history.back();
    }

    window.addEventListener('popstate', function(e) {
      if (_popSkip > 0) { _popSkip--; return; }
      if (_navStack.length === 0) return;
      var state = _navStack.pop();
      _isNavClosing = true;
      state.closeFn();
      _isNavClosing = false;
    });

    // Replace initial history state to mark the base
    history.replaceState({}, '', '/');
`;
