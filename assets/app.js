(function(){
  const root = document.getElementById('menu-root');
  fetch('menu-data.json?v=' + Date.now())
    .then(r => r.json())
    .then(data => {
      renderMenu(root, data);
      if (data.settings && data.settings.cafeName){
        document.title = data.settings.cafeName + ' — منو';
      }
      if (window.matchMedia){
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => renderMenu(root, data));
      }
    })
    .catch(() => {
      root.innerHTML = '<p style="text-align:center;padding:60px 20px;font-family:sans-serif">خطا در بارگذاری منو. لطفاً بعداً دوباره تلاش کنید.</p>';
    });
})();
