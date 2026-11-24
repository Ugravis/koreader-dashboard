export const THEME_COOKIE = 'theme'
export const DARK_QUERY = '(prefers-color-scheme: dark)'

/**
 * Runs before the first paint (inline in <head>): applies the saved theme, no flash.
 * Reads a cookie so the page stays statically prerendered.
 */
export const themeScript = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]*)/);var t=m?m[1]:"system";var d=t==="dark"||(t!=="light"&&matchMedia("${DARK_QUERY}").matches);var e=document.documentElement;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light"}catch(e){}})()`
