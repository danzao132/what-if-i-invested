export const THEME_KEY = "wiii:theme";

/** Inline, pre-paint script: applies the saved theme before first render. */
export const themeScript = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;}catch(e){}})();`;
