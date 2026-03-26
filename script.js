document.addEventListener('DOMContentLoaded', () => {
  const images = document.querySelectorAll('.draggable');
  let highestZIndex = 100;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Center images initially, then scatter with animation
  images.forEach(img => {
    const imgHeight = img.offsetHeight || 200;
    const imgWidth = img.offsetWidth || 200;
    img.style.top = `${(viewportHeight - imgHeight) / 2}px`;
    img.style.left = `${(viewportWidth - imgWidth) / 2}px`;
    img.classList.add('animating');
  });

  setTimeout(() => {
    randomizePositions(images, window.innerWidth, window.innerHeight);
    setTimeout(() => {
      images.forEach(img => img.classList.remove('animating'));
    }, 1000);
  }, 100);

  images.forEach(img => makeDraggable(img));

  // Double-click to expand sticky notes
  let activeOverlay = null;
  let expandedNote = null;
  let savedPosition = null;

  function expandNote(note) {
    if (expandedNote) return;
    savedPosition = { top: note.style.top, left: note.style.left, zIndex: note.style.zIndex, width: note.style.width };
    expandedNote = note;

    activeOverlay = document.createElement('div');
    activeOverlay.classList.add('note-overlay');
    document.body.appendChild(activeOverlay);

    const maxW = Math.min(600, window.innerWidth * 0.9);
    note.style.width = maxW + 'px';
    note.classList.add('note-expanded');

    activeOverlay.addEventListener('click', collapseNote);
  }

  function collapseNote() {
    if (!expandedNote) return;
    expandedNote.classList.remove('note-expanded');
    expandedNote.style.top = savedPosition.top;
    expandedNote.style.left = savedPosition.left;
    expandedNote.style.zIndex = savedPosition.zIndex;
    expandedNote.style.width = savedPosition.width;
    expandedNote.style.transform = 'none';

    if (activeOverlay) {
      activeOverlay.remove();
      activeOverlay = null;
    }
    expandedNote = null;
    savedPosition = null;
  }

  document.querySelectorAll('.gallery .sticky-note').forEach(note => {
    const handles = note.querySelectorAll('.note-title, .note-header-row');
    handles.forEach(handle => {
      handle.addEventListener('dblclick', (e) => {
        if (e.target.closest('a, button, input, canvas, select, textarea')) return;
        expandNote(note);
      });
    });
  });

  // Grid organize toggle
  let isGridded = false;
  const gridBtn = document.getElementById('grid-btn');
  if (gridBtn) {
    gridBtn.addEventListener('click', () => {
      const notes = document.querySelectorAll('.gallery .draggable');
      if (isGridded) {
        // Scatter back
        notes.forEach(n => n.classList.add('animating'));
        randomizePositions(notes, window.innerWidth, window.innerHeight);
        setTimeout(() => notes.forEach(n => n.classList.remove('animating')), 1000);
        gridBtn.textContent = 'Organize';
        isGridded = false;
      } else {
        // Tight grid / masonry packing
        const hero = document.getElementById('floating-hero');
        const heroRect = hero ? hero.getBoundingClientRect() : { bottom: 0, right: 0 };
        const startX = Math.max(heroRect.right + 30, 40);
        const startY = 30;
        const gap = 14;
        const maxX = window.innerWidth - 30;
        const placed = []; // {x, y, w, h}

        // Also treat hero as a placed rect
        if (hero) {
          placed.push({
            x: heroRect.left - gap,
            y: heroRect.top - gap,
            w: heroRect.width + gap * 2,
            h: heroRect.height + gap * 2
          });
        }

        function intersects(ax, ay, aw, ah) {
          for (const p of placed) {
            if (ax < p.x + p.w && ax + aw > p.x && ay < p.y + p.h && ay + ah > p.y) return true;
          }
          return false;
        }

        // Sort notes: taller/wider first for better packing
        const sorted = Array.from(notes).sort((a, b) => {
          const areaA = (a.offsetWidth || 260) * (a.offsetHeight || 200);
          const areaB = (b.offsetWidth || 260) * (b.offsetHeight || 200);
          return areaB - areaA;
        });

        sorted.forEach(n => {
          n.classList.add('animating');
          const w = n.offsetWidth || 260;
          const h = n.offsetHeight || 200;
          const bw = w + gap;
          const bh = h + gap;
          let bestX = startX, bestY = startY;
          let found = false;

          // Scan candidate positions: top-left corners of gaps
          // Try y in steps, then x in steps, pick first fit
          const step = 8;
          for (let ty = startY; ty < window.innerHeight - h; ty += step) {
            for (let tx = startX; tx + w <= maxX; tx += step) {
              if (!intersects(tx, ty, bw, bh)) {
                bestX = tx;
                bestY = ty;
                found = true;
                break;
              }
            }
            if (found) break;
          }

          n.style.top = bestY + 'px';
          n.style.left = bestX + 'px';
          n.style.transform = 'none';
          n.style.visibility = 'visible';

          placed.push({ x: bestX, y: bestY, w: bw, h: bh });
        });

        setTimeout(() => notes.forEach(n => n.classList.remove('animating')), 1000);
        gridBtn.textContent = 'Scatter';
        isGridded = true;
      }
    });
  }


  function isOverlapping(r1, r2) {
    return !(r1.right < r2.left ||
      r1.left > r2.right ||
      r1.bottom < r2.top ||
      r1.top > r2.bottom);
  }

  function makeDraggable(element) {
    let animFrameId = null;
    let targetX = 0, targetY = 0;
    let currentX = 0, currentY = 0;
    let velocityX = 0;
    let dragging = false;

    function getXY(e) {
      if (e.touches && e.touches.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      if (e.changedTouches && e.changedTouches.length) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
      return { x: e.clientX, y: e.clientY };
    }

    function toLocal(viewportX, viewportY) {
      const parent = element.offsetParent || document.body;
      const pr = parent.getBoundingClientRect();
      return { x: viewportX - pr.left, y: viewportY - pr.top };
    }

    // Attach drag to header handles only, but move the whole element
    const handles = element.querySelectorAll('.note-title, .note-header-row');
    const targets = handles.length > 0 ? handles : [element];
    targets.forEach(h => {
      h.addEventListener('mousedown', onDown);
      h.addEventListener('touchstart', onDown, { passive: false });
    });

    function onDown(e) {
      if (e.target.closest('a, button, input, canvas, select, textarea')) return;

      e.preventDefault();
      e.stopPropagation();

      const ptr = getXY(e);
      const rect = element.getBoundingClientRect();
      const grabX = ptr.x - rect.left;
      const grabY = ptr.y - rect.top;

      highestZIndex++;
      element.style.zIndex = highestZIndex;
      element.classList.remove('animating');
      element.classList.add('is-dragging');

      // Init position from current local coords
      const startLocal = toLocal(rect.left, rect.top);
      currentX = startLocal.x;
      currentY = startLocal.y;
      targetX = currentX;
      targetY = currentY;
      velocityX = 0;
      dragging = true;

      function onMove(ev) {
        ev.preventDefault();
        const p = getXY(ev);
        const local = toLocal(p.x - grabX, p.y - grabY);
        targetX = local.x;
        targetY = local.y;
      }

      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
        dragging = false;
        element.classList.remove('is-dragging');
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onUp);

      if (!animFrameId) animFrameId = requestAnimationFrame(tick);
    }

    let currentRot = 0;

    function tick() {
      const lerp = 0.18;
      const prevX = currentX;
      currentX += (targetX - currentX) * lerp;
      currentY += (targetY - currentY) * lerp;
      velocityX = currentX - prevX;

      element.style.left = currentX + 'px';
      element.style.top = currentY + 'px';

      if (dragging) {
        const targetRot = Math.max(-10, Math.min(10, velocityX * 0.4));
        currentRot += (targetRot - currentRot) * 0.3;
      } else {
        currentRot += (0 - currentRot) * 0.08;
      }

      if (Math.abs(currentRot) > 0.05) {
        element.style.transform = `rotate(${currentRot}deg)`;
      } else {
        currentRot = 0;
        element.style.transform = 'none';
      }

      const settled = !dragging
        && Math.abs(targetX - currentX) < 0.5
        && Math.abs(targetY - currentY) < 0.5
        && Math.abs(currentRot) < 0.05;

      if (settled) {
        element.style.transform = 'none';
        animFrameId = null;
      } else {
        animFrameId = requestAnimationFrame(tick);
      }
    }
  }

  // Debounced resize handler
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      images.forEach(img => img.classList.add('animating'));
      randomizePositions(images, window.innerWidth, window.innerHeight);
      setTimeout(() => {
        images.forEach(img => img.classList.remove('animating'));
      }, 1000);
    }, 200);
  });

  // Generate floating index links
  const indexContainer = document.getElementById('index-content');
  indexContainer.innerHTML = '';

  const projects = document.querySelectorAll('.project-section');
  projects.forEach(project => {
    const title = project.querySelector('h2').textContent;
    const link = document.createElement('a');
    link.textContent = title;
    link.addEventListener('click', () => {
      project.scrollIntoView({ behavior: 'smooth' });
    });
    indexContainer.appendChild(link);
  });

  // Expandable project captions
  const projectDetails = document.querySelectorAll('.project-details');
  projectDetails.forEach(detail => {
    detail.addEventListener('click', () => {
      const section = detail.closest('.project-section');
      section.classList.toggle('expanded');
    });
  });

  // Snippet expand/collapse (bio + project details)
  const snippets = document.querySelectorAll('.box-content');
  snippets.forEach(snippet => {
    snippet.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') return;
      if (snippet.classList.contains('animating')) return;

      snippet.classList.add('animating');
      snippet.classList.add('content-hidden');

      setTimeout(() => {
        snippet.classList.toggle('expanded');
        snippet.classList.toggle('snippet');

        setTimeout(() => {
          snippet.classList.remove('content-hidden');
          snippet.classList.remove('animating');
        }, 10);
      }, 10);
    });
  });

  // Index toggle
  const indexExpandBtn = document.getElementById('index-expand-btn');
  const indexListContainer = document.getElementById('index-list-container');

  indexExpandBtn.addEventListener('click', () => {
    indexListContainer.classList.toggle('collapsed');
  });

  // Are.na gallery (horizontal scroll like photo gallery)
  const arenaNote = document.querySelector('.sticky-arena');
  if (arenaNote) {
    const galleryEl = arenaNote.querySelector('.arena-gallery');
    const counterEl = arenaNote.querySelector('.arena-counter');

    function updateArenaCounter() {
      const imgs = galleryEl.querySelectorAll('.arena-slide');
      if (imgs.length <= 1) { counterEl.textContent = ''; return; }
      const scrollIdx = Math.round(galleryEl.scrollLeft / (imgs[0].offsetWidth + 6));
      counterEl.textContent = `${scrollIdx + 1} / ${imgs.length}`;
    }

    function fetchArena() {
      fetch('https://api.are.na/v3/channels/two-zero-two-six-2m8-hk_mexy/contents')
        .then(r => r.json())
        .then(res => {
          const blocks = res.data || res;
          const imageBlocks = blocks.filter(b => b.type === 'Image' && b.image).reverse();
          if (imageBlocks.length === 0) return;

          galleryEl.innerHTML = '';
          imageBlocks.forEach(block => {
            const src = block.image.large ? block.image.large.src : block.image.src;
            const slide = document.createElement('div');
            slide.classList.add('arena-slide');
            slide.innerHTML = `<img src="${src}" alt="${block.title || 'Are.na'}">`;
            galleryEl.appendChild(slide);
          });

          updateArenaCounter();
        })
        .catch(() => {
          galleryEl.innerHTML = '<div class="arena-loading">could not load</div>';
        });
    }

    galleryEl.addEventListener('scroll', updateArenaCounter);
    fetchArena();
    setInterval(fetchArena, 60000);
  }

  // Sticky note photo galleries
  document.querySelectorAll('.sticky-gallery').forEach(note => {
    const galleries = note.querySelectorAll('.note-gallery');
    const titleEl = note.querySelector('.gallery-date-title');
    const counter = note.querySelector('.note-gallery-counter');
    const prevDateBtn = note.querySelector('.gallery-prev-date');
    const nextDateBtn = note.querySelector('.gallery-next-date');
    let currentIndex = Array.from(galleries).findIndex(g => g.style.display !== 'none');
    if (currentIndex === -1) currentIndex = 0;

    function showGallery(idx) {
      galleries.forEach(g => g.style.display = 'none');
      galleries[idx].style.display = 'flex';
      galleries[idx].scrollLeft = 0;
      titleEl.textContent = galleries[idx].dataset.gallery;
      currentIndex = idx;
      updateCounter();
    }

    function updateCounter() {
      const g = galleries[currentIndex];
      const imgs = g.querySelectorAll('.note-gallery-img');
      if (imgs.length > 1) {
        const scrollIdx = Math.round(g.scrollLeft / (g.firstElementChild.offsetWidth + 6));
        counter.textContent = `${scrollIdx + 1} / ${imgs.length}`;
      } else {
        counter.textContent = `1 / ${imgs.length}`;
      }
    }

    prevDateBtn.addEventListener('click', () => {
      const newIdx = (currentIndex - 1 + galleries.length) % galleries.length;
      showGallery(newIdx);
    });

    nextDateBtn.addEventListener('click', () => {
      const newIdx = (currentIndex + 1) % galleries.length;
      showGallery(newIdx);
    });

    galleries.forEach(g => g.addEventListener('scroll', updateCounter));
    updateCounter();
  });

  // Pong
  const pongCanvas = document.getElementById('pong-canvas');
  if (pongCanvas) {
    const ctx = pongCanvas.getContext('2d');
    const paddleH = 6, ballR = 5;
    let W, H, paddleW;
    let p1x, p2x;
    let bx, by, bvx = 0, bvy = 0;
    let s1 = 0, s2 = 0;
    let mouseX;
    let running = false;
    const startBtn = document.getElementById('pong-start');
    const stopBtn = document.getElementById('pong-stop');
    const restartBtn = document.getElementById('pong-restart');

    function sizePong() {
      const rect = pongCanvas.getBoundingClientRect();
      const cw = Math.round(rect.width);
      const ch = Math.round(rect.height);
      if (cw < 1 || ch < 1) return;
      pongCanvas.width = cw;
      pongCanvas.height = ch;
      W = cw;
      H = ch;
      paddleW = Math.round(W * 0.28);
      if (mouseX === undefined) mouseX = W / 2;
      if (p1x === undefined) { p1x = W / 2; p2x = W / 2; bx = W / 2; by = H / 2; }
      drawFrame();
    }

    function resetBall(dir) {
      bx = W / 2; by = H / 2;
      bvx = (Math.random() > 0.5 ? 1 : -1) * 1.8;
      bvy = dir * 2.2;
    }

    function fullReset() {
      running = false;
      s1 = 0; s2 = 0;
      p1x = W / 2; p2x = W / 2;
      bx = W / 2; by = H / 2;
      bvx = 0; bvy = 0;
      startBtn.disabled = false;
      stopBtn.disabled = true;
      drawFrame();
    }

    startBtn.addEventListener('click', () => {
      if (!running) {
        running = true;
        if (bvx === 0 && bvy === 0) resetBall(1);
        startBtn.disabled = true;
        stopBtn.disabled = false;
      }
    });

    stopBtn.addEventListener('click', () => {
      running = false;
      startBtn.disabled = false;
      stopBtn.disabled = true;
      drawFrame();
    });

    restartBtn.addEventListener('click', () => {
      fullReset();
    });

    pongCanvas.addEventListener('mousemove', e => {
      const rect = pongCanvas.getBoundingClientRect();
      mouseX = (e.clientX - rect.left) * (W / rect.width);
    });

    pongCanvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const rect = pongCanvas.getBoundingClientRect();
      mouseX = (e.touches[0].clientX - rect.left) * (W / rect.width);
    }, { passive: false });

    function drawFrame() {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, W, H);

      // Dashed center line
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Score on canvas
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.font = 'bold ' + Math.round(H * 0.12) + 'px var(--font-main, sans-serif)';
      ctx.textAlign = 'center';
      ctx.fillText(s1, W / 2, H * 0.62);
      ctx.fillText(s2, W / 2, H * 0.42);

      // Paddles
      ctx.fillStyle = '#fff';
      ctx.fillRect(p1x - paddleW / 2, H - paddleH - 8, paddleW, paddleH);
      ctx.fillRect(p2x - paddleW / 2, 8, paddleW, paddleH);

      // Ball
      ctx.beginPath();
      ctx.arc(bx, by, ballR, 0, Math.PI * 2);
      ctx.fill();
    }

    function pongLoop() {
      if (running) {
        // Player paddle — snappier
        p1x += (mouseX - p1x) * 0.35;
        p1x = Math.max(paddleW / 2, Math.min(W - paddleW / 2, p1x));

        // AI paddle — slower & dumber
        const aiTarget = bx + (bvy < 0 ? bvx * ((paddleH + 10 - by) / (bvy || 1)) : 0);
        p2x += (aiTarget - p2x) * 0.035;
        p2x = Math.max(paddleW / 2, Math.min(W - paddleW / 2, p2x));

        // Ball
        bx += bvx; by += bvy;

        // Wall bounce
        if (bx - ballR <= 0 || bx + ballR >= W) bvx = -bvx;

        // Paddle collision — bottom (player)
        if (by + ballR >= H - paddleH - 8 && bvy > 0) {
          if (bx > p1x - paddleW / 2 - ballR && bx < p1x + paddleW / 2 + ballR) {
            bvy = -bvy;
            bvx += (bx - p1x) * 0.08;
            by = H - paddleH - 8 - ballR;
          }
        }

        // Paddle collision — top (AI)
        if (by - ballR <= paddleH + 8 && bvy < 0) {
          if (bx > p2x - paddleW / 2 - ballR && bx < p2x + paddleW / 2 + ballR) {
            bvy = -bvy;
            bvx += (bx - p2x) * 0.08;
            by = paddleH + 8 + ballR;
          }
        }

        // Score
        if (by > H + ballR) { s2++; resetBall(-1); }
        if (by < -ballR) { s1++; resetBall(1); }

        // Speed cap — lower
        bvx = Math.max(-4, Math.min(4, bvx));

        drawFrame();
      }

      requestAnimationFrame(pongLoop);
    }

    sizePong();
    window.addEventListener('resize', sizePong);
    pongLoop();
  }

  // Slideshow navigation
  const sliders = document.querySelectorAll('.slideshow');
  sliders.forEach(slider => {
    const container = document.createElement('div');
    container.classList.add('slideshow-container');
    slider.parentNode.insertBefore(container, slider);
    container.appendChild(slider);

    const prevBtn = document.createElement('button');
    prevBtn.classList.add('nav-btn', 'prev');
    prevBtn.textContent = '\u2190';

    const nextBtn = document.createElement('button');
    nextBtn.classList.add('nav-btn', 'next');
    nextBtn.textContent = '\u2192';

    container.insertBefore(prevBtn, slider);
    container.appendChild(nextBtn);

    const updateButtonVisibility = () => {
      prevBtn.classList.toggle('hidden', slider.scrollLeft <= 0);
      nextBtn.classList.toggle('hidden', slider.scrollLeft + slider.clientWidth >= slider.scrollWidth - 1);
    };

    updateButtonVisibility();
    slider.addEventListener('scroll', updateButtonVisibility);
    window.addEventListener('load', updateButtonVisibility);

    const resizeObserver = new ResizeObserver(updateButtonVisibility);
    resizeObserver.observe(slider);

    // Slide counter
    const slides = slider.querySelectorAll('img, video');
    if (slides.length > 0) {
      const counter = document.createElement('div');
      counter.classList.add('slide-counter');
      counter.textContent = `1/${slides.length}`;
      container.appendChild(counter);

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const index = Array.from(slides).indexOf(entry.target);
            if (index !== -1) {
              counter.textContent = `${index + 1}/${slides.length}`;
            }
          }
        });
      }, { root: slider, threshold: 0.5 });

      slides.forEach(slide => observer.observe(slide));
    }

    prevBtn.addEventListener('click', () => {
      slider.scrollBy({ left: -slider.clientWidth, behavior: 'smooth' });
    });

    nextBtn.addEventListener('click', () => {
      slider.scrollBy({ left: slider.clientWidth, behavior: 'smooth' });
    });
  });
});

function randomizePositions(images, viewportWidth, viewportHeight) {
  const isMobile = viewportWidth < 1025;

  if (isMobile) {
    // On mobile/tablet, notes are in a horizontal scroll — no positioning needed
    images.forEach(img => {
      img.style.transform = 'none';
      img.style.visibility = 'visible';
    });
  } else {
    // Get header rect to use as exclusion zone
    const hero = document.getElementById('floating-hero');
    const heroRect = hero ? hero.getBoundingClientRect() : null;
    const margin = 20; // extra margin around header

    const maxOverlap = 0.2; // max 1/5 overlap
    const maxAttempts = 100;
    const edgePad = 20;

    images.forEach((img, index) => {
      const imgHeight = img.offsetHeight || 200;
      const imgWidth = img.offsetWidth || 200;

      let randomTop, randomLeft;
      let isValidPosition = false;
      let attempts = 0;

      while (!isValidPosition && attempts < maxAttempts) {
        attempts++;
        randomTop = edgePad + Math.floor(Math.random() * (viewportHeight - imgHeight - edgePad * 2));
        randomLeft = edgePad + Math.floor(Math.random() * (viewportWidth - imgWidth - edgePad * 2));

        if (randomTop < 0) randomTop = edgePad;
        if (randomLeft < 0) randomLeft = edgePad;

        isValidPosition = true;

        // Check overlap with header
        if (heroRect) {
          const hTop = heroRect.top - margin;
          const hLeft = heroRect.left - margin;
          const hBottom = heroRect.bottom + margin;
          const hRight = heroRect.right + margin;

          const overH = Math.max(0, Math.min(randomTop + imgHeight, hBottom) - Math.max(randomTop, hTop));
          const overW = Math.max(0, Math.min(randomLeft + imgWidth, hRight) - Math.max(randomLeft, hLeft));
          if (overH > 0 && overW > 0) {
            isValidPosition = false;
            continue;
          }
        }

        // Check overlap with other notes (max 1/5 of smaller note)
        for (let i = 0; i < images.length; i++) {
          if (i === index) continue;

          const otherImg = images[i];
          const otherTop = parseInt(otherImg.style.top) || 0;
          const otherLeft = parseInt(otherImg.style.left) || 0;
          const otherHeight = otherImg.offsetHeight || 200;
          const otherWidth = otherImg.offsetWidth || 200;

          const overlapHeight = Math.max(0, Math.min(randomTop + imgHeight, otherTop + otherHeight) - Math.max(randomTop, otherTop));
          const overlapWidth = Math.max(0, Math.min(randomLeft + imgWidth, otherLeft + otherWidth) - Math.max(randomLeft, otherLeft));
          const overlapArea = overlapHeight * overlapWidth;
          const smallerArea = Math.min(imgWidth * imgHeight, otherWidth * otherHeight);

          if (overlapArea > maxOverlap * smallerArea) {
            isValidPosition = false;
            break;
          }
        }
      }

      img.style.top = `${randomTop}px`;
      img.style.left = `${randomLeft}px`;
      img.style.transform = 'none';
      img.style.visibility = 'visible';
    });
  }
}
