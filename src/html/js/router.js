export const router = `
    // ==================== SPA Router ====================
    var _navStack = [];
    var _popSkip = 0;
    var _isNavClosing = false;

    // Routes that are internal-only: no address bar change, no deep linking
    var _navBlacklist = ['/add','/detail','/time','/view','/calendar'];

    // Deep linking: save initial path before replaceState
    var _initialPath = window.location.pathname;
    var _spaRoutes = ['/settings','/stats','/trash','/category','/changelog'];
    if (_spaRoutes.indexOf(_initialPath) !== -1) {
      try { sessionStorage.setItem('_spa_initial_path', _initialPath); } catch(e) {}
    }

    function _navPush(id, closeFn, path) {
      _navStack.push({ id: id, closeFn: closeFn });
      var target = _navBlacklist.indexOf(path) !== -1
        ? window.location.pathname + (window.location.search || '')
        : path;
      history.pushState({ _nav: true }, '', target);
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

    // Replace initial history state to mark the base (preserve query params like ?preview=1)
    history.replaceState({}, '', '/' + (window.location.search || ''));

    // Deep linking: restore overlay from saved path (called after bootstrap)
    async function _navRestore() {
      var path = '';
      try { path = sessionStorage.getItem('_spa_initial_path') || ''; } catch(e) {}
      try { sessionStorage.removeItem('_spa_initial_path'); } catch(e) {}
      if (!path || path === '/') return;
      // Ensure categories are loaded before opening views that depend on them
      if (path === '/category') {
        await loadCategories();
      }
      switch (path) {
        case '/settings': openSettings(); break;
        case '/stats': openStats(); break;
        case '/trash': openTrash(); break;
        case '/category': toggleCategoryMenu('search'); break;
        case '/changelog': openChangelogModal(); break;
      }
    }
`;
