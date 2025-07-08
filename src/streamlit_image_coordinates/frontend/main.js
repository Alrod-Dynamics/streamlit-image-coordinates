// main.js
function sendValue(value) {
  Streamlit.setComponentValue(value)
}

document.addEventListener("DOMContentLoaded", () => {
  const image = document.getElementById("image")
  const wrapper = document.querySelector(".image-wrapper")
  const coordsDisplay = document.getElementById("coordinatesDisplay")
  const zoomInBtn = document.getElementById("zoomInBtn")
  const zoomOutBtn = document.getElementById("zoomOutBtn")
  const resetZoomBtn = document.getElementById("resetZoomBtn")

  let currentScale = 1
  let translateX = 0
  let translateY = 0
  let isDragging = false
  let dragStartX = 0, dragStartY = 0
  let dragStartTX = 0, dragStartTY = 0
  let prevScale = 1  // track previous scale to conditionally clamp
  let zooming = false;
  let followRAF = null;

  // --- Utility to clamp pan so no white bars ever show ---
  function clampPan() {
      // no-op to allow free panning in all directions
  }

  // function updateTransform() {
  //   clampPan()
  //   image.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentScale})`
  // }
  function updateTransform() {
    // always clamp pan to keep image within wrapper bounds
    clampPan()
    image.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentScale})`;
    prevScale = currentScale
    updateClickPoint()
  }

  // --- Zoom helpers ---
  const ZOOM_STEP = 1.03  // 5% per notch
  const MAX_SCALE = 8  // max zoom level
  // function getMinScale() {
  //   const wrap = document.querySelector(".image-wrapper").getBoundingClientRect()
  //   return Math.max( wrap.width  / image.naturalWidth,
  //                    wrap.height / image.naturalHeight,
  //                    0.1 )  // never go to zero
  // }

  function getMinScale() {
    const wrap = document.querySelector(".image-wrapper").getBoundingClientRect()
    // compute the scale that would make the image JUST fill the container
    const fitScale = Math.max(
      wrap.width / image.naturalWidth,
      wrap.height / image.naturalHeight
    )
    // but allow zoom-out down to 50% of the container
    return fitScale * 0.5
  }

  // function zoomAt(mx, my, newScale) {
  //   const wrap = document.querySelector(".image-wrapper").getBoundingClientRect()
  //   // pointer relative to top-left of wrapper
  //   const relX = mx - wrap.left
  //   const relY = my - wrap.top

  //   // compute new translate so point under mouse stays fixed
  //   const invOld = 1 / currentScale
  //   const invNew = 1 / newScale
  //   translateX += relX * (invNew - invOld)
  //   translateY += relY * (invNew - invOld)

  //   currentScale = newScale
  //   updateTransform()
  // }

  function follow() {
    updateClickPoint();
    if (zooming) followRAF = requestAnimationFrame(follow);
  }

  image.addEventListener('transitionend', e => {
    if (e.propertyName === 'transform') {
      zooming = false;
      if (followRAF) cancelAnimationFrame(followRAF);
    }
  });

  function zoomAt(mouseX, mouseY, newScale) {
    // sync dot during smooth zoom
    zooming = true;
     const wrap = document.querySelector(".image-wrapper").getBoundingClientRect();
     const localX = mouseX - wrap.left;
     const localY = mouseY - wrap.top;

     // keep point under cursor fixed: use scale ratio
     const ratio = newScale / currentScale;
     translateX = translateX * ratio + (1 - ratio) * localX;
     translateY = translateY * ratio + (1 - ratio) * localY;

     currentScale = newScale;
    updateTransform();
    // start updating dot through transition
    followRAF = requestAnimationFrame(follow);
  }

  function zoomIn(mx, my) {
    // compute desired new scale, but cap it
    const target = Math.min(currentScale * ZOOM_STEP, MAX_SCALE)
    zoomAt(mx, my, target)
  }
  function zoomOut(mx, my) {
    // allow unlimited zoom out (limited by practical scale)
    const target = currentScale / ZOOM_STEP;
    zoomAt(mx, my, target);
  }
  function resetZoom() {
    // reset to natural size
    currentScale = 1;
    translateX = 0;
    translateY = 0;
    updateTransform();
  }

  // --- Mouse & wheel events ---
  let lastMX = 0, lastMY = 0
  let panTimeout = null  // debounce for panning class
  wrapper.addEventListener("mousemove", e => {
    lastMX = e.clientX; lastMY = e.clientY
    if (isDragging) {
      // account for scale: divide pointer movement by currentScale
      translateX = dragStartTX + (e.clientX - dragStartX) / currentScale
      translateY = dragStartTY + (e.clientY - dragStartY) / currentScale
      updateTransform()
      coordsDisplay.textContent = `Dragging… | ${currentScale.toFixed(2)}×`
      return
    }
    // otherwise show live coords
    const rect = image.getBoundingClientRect()
    const ix = e.clientX - rect.left
    const iy = e.clientY - rect.top

    const w = rect.width
    const h = rect.height
    const rawX = Math.round(ix * image.naturalWidth / w)
    const rawY = Math.round(iy * image.naturalHeight / h)
    if (rawX >= 0 && rawX < image.naturalWidth && rawY >= 0 && rawY < image.naturalHeight) {
      coordsDisplay.textContent = `Mouse: (${rawX}, ${rawY}) | ${currentScale.toFixed(2)}x`
    }
  })

  wrapper.addEventListener("mousedown", e => {
    if (e.button === 2) {
      e.preventDefault()
      isDragging = true
      dragStartX = e.clientX; dragStartY = e.clientY
      dragStartTX = translateX; dragStartTY = translateY
      image.classList.add("dragging")
    }
    updateClickPoint();
  })
  wrapper.addEventListener("mouseup", () => { isDragging = false; image.classList.remove("dragging") })
  wrapper.addEventListener("mouseleave", () => { isDragging = false; image.classList.remove("dragging") })
  wrapper.addEventListener("contextmenu", e => e.preventDefault())

  let clickPoint = null;

  // 1) Replace your old updateClickPoint() with this:
  function updateClickPoint() {
    if (!clickPoint) return;

    // grab the raw pixel we stored
    const rawX = parseFloat(clickPoint.dataset.rawX);
    const rawY = parseFloat(clickPoint.dataset.rawY);

    // get the actual on-screen position & size of the <img>
    const imgRect = image.getBoundingClientRect();
    const wrapperRect = image.parentElement.getBoundingClientRect();

    // compute fractional position within the natural image
    const fx = rawX / image.naturalWidth;
    const fy = rawY / image.naturalHeight;

    // map that fraction onto the displayed size
    const dispX = (imgRect.left - wrapperRect.left) + fx * imgRect.width;
    const dispY = (imgRect.top - wrapperRect.top) + fy * imgRect.height;

    // set the dot there
    clickPoint.style.left = `${dispX}px`;
    clickPoint.style.top = `${dispY}px`;
  }

  image.addEventListener("click", e => {
    if (e.button !== 0) return;

    // 1) compute raw image pixel
    const rect = image.getBoundingClientRect();
    const ix = e.clientX - rect.left;
    const iy = e.clientY - rect.top;
    const rawX = Math.round(ix * image.naturalWidth / rect.width);
    const rawY = Math.round(iy * image.naturalHeight / rect.height);

    // send it back…
    coordsDisplay.textContent = `Pixel: (${rawX}, ${rawY})`;
    sendValue({ x: rawX, y: rawY });

    // 2) (re)create the dot anchored on rawX, rawY
    const wrapper = document.querySelector(".image-wrapper");
    if (clickPoint) clickPoint.remove();

    clickPoint = document.createElement("div");
    clickPoint.className = "click-point";
    clickPoint.dataset.rawX = rawX;
    clickPoint.dataset.rawY = rawY;
    wrapper.appendChild(clickPoint);

    // 3) position it correctly now
    updateClickPoint();
  });

  wrapper.addEventListener("wheel", e => {
    e.preventDefault();
    lastMX = e.clientX; lastMY = e.clientY;
    if (e.ctrlKey) {
        if (e.deltaY < 0) zoomIn(e.clientX, e.clientY);
        else zoomOut(e.clientX, e.clientY);
    } else {
        // pan with wheel: instant pixel-to-pixel mapping for trackpad
        clearTimeout(panTimeout);
        image.classList.add('dragging');
        translateX += -e.deltaX;
        translateY += -e.deltaY;
        updateTransform();
        panTimeout = setTimeout(() => { image.classList.remove('dragging') }, 50);
    }
    updateClickPoint();
  })

  zoomInBtn.addEventListener("click", () => zoomIn(lastMX, lastMY))
  zoomOutBtn.addEventListener("click", () => zoomOut(lastMX, lastMY))
  resetZoomBtn.addEventListener("click", resetZoom)

  // --- initialize once image loads ---
  image.onload = () => {
    resetZoom()
    Streamlit.setFrameHeight(600)
  }

  // handle Streamlit rerenders
  Streamlit.events.addEventListener(Streamlit.RENDER_EVENT, onRender)
  Streamlit.setComponentReady()

  function onRender(event) {
    const { src, width, height, use_column_width } = event.detail.args
    if (image.src !== src) image.src = src
    // Let your existing resize logic here…
  }
})

// disable clampPan
function clampPan() { }