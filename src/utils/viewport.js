// Đồng bộ chính xác chiều cao khung nhìn (Viewport) trên iPhone (Dynamic Island / Tai thỏ / Home Indicator) & Android.
// Xử lý triệt để 2 lỗi kinh điển của iOS Standalone PWA (black-translucent + viewport-fit=cover):
// 1. Khi bàn phím đóng: WebKit trừ nhầm safe-area khỏi innerHeight/100dvh để lại dải đen trống ở đáy màn hình.
// 2. Khi mở/đóng bàn phím ảo: WebKit tự đẩy cuộn gốc tọa độ (0, 0) lên trên làm lệch toàn bộ giao diện.

let isInitialized = false;

export function initMobileViewportFix() {
  if (typeof window === 'undefined' || typeof document === 'undefined' || isInitialized) return;
  isInitialized = true;

  const root = document.documentElement;
  const ua = navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const checkStandalone = () =>
    Boolean(
      window.navigator?.standalone ||
        (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
    );

  const updateViewport = () => {
    const vv = window.visualViewport;
    const vvHeight = vv ? vv.height : window.innerHeight;
    const isPortrait = window.innerHeight >= window.innerWidth;

    const screenW = window.screen?.width || 0;
    const screenH = window.screen?.height || 0;
    const physicalScreenHeight = isPortrait ? Math.max(screenW, screenH) : Math.min(screenW, screenH);
    const physicalScreenWidth = isPortrait ? Math.min(screenW, screenH) : Math.max(screenW, screenH);

    const isFullWidthWindow = physicalScreenWidth > 0 && Math.abs(physicalScreenWidth - window.innerWidth) <= 24;
    const heightDiff = physicalScreenHeight > 0 ? physicalScreenHeight - vvHeight : 0;
    const isKeyboardOpen = isFullWidthWindow && heightDiff > 115;

    root.classList.toggle('keyboard-open', isKeyboardOpen);

    let targetHeight = vvHeight;
    // Trên iPhone chạy chế độ ứng dụng màn hình chính (Standalone PWA):
    // khi bàn phím đang đóng, lấp đầy đúng chiều cao màn hình vật lý CSS (ví dụ 852px trên iPhone 15 Pro)
    // để không bao giờ bị hở dải đen ở cạnh dưới.
    if (
      isIOS &&
      checkStandalone() &&
      isFullWidthWindow &&
      !isKeyboardOpen &&
      physicalScreenHeight >= vvHeight &&
      heightDiff <= 115
    ) {
      targetHeight = physicalScreenHeight;
    }

    if (targetHeight > 0) {
      root.style.setProperty('--app-height', `${Math.round(targetHeight)}px`);
    }

    if (isIOS && (window.scrollY !== 0 || window.scrollX !== 0)) {
      window.scrollTo(0, 0);
    }
  };

  updateViewport();

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateViewport);
    window.visualViewport.addEventListener('scroll', updateViewport);
  }
  window.addEventListener('resize', updateViewport);
  window.addEventListener('pageshow', updateViewport);
  window.addEventListener('orientationchange', () => {
    setTimeout(updateViewport, 100);
    setTimeout(updateViewport, 300);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      updateViewport();
    }
  });
  document.addEventListener(
    'focusout',
    () => {
      setTimeout(() => {
        if (isIOS) window.scrollTo(0, 0);
        updateViewport();
      }, 60);
    },
    true
  );
}
