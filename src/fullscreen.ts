// Full screen on and off (Ctrl+F by default, More → Fullscreen): as More's own item does it - the Android app's
// own full screen there, the browser's elsewhere. (F11 is the browser's own, and stays.)
export function toggleFullscreen(): void {
  document.getElementById("m-fullscreen")?.click();
}
