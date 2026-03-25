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
    const rect = note.getBoundingClientRect();
    const ratio = rect.width / rect.height;
    savedPosition = { top: note.style.top, left: note.style.left, zIndex: note.style.zIndex, width: note.style.width };
    expandedNote = note;

    activeOverlay = document.createElement('div');
    activeOverlay.classList.add('note-overlay');
    document.body.appendChild(activeOverlay);

    // Scale up keeping aspect ratio, capped by viewport
    const maxH = window.innerHeight * 0.714;
    const maxW = window.innerWidth * 0.9;
    let newH = maxH;
    let newW = newH * ratio;
    if (newW > maxW) { newW = maxW; newH = newW / ratio; }
    note.style.width = newW + 'px';

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

  document.querySelectorAll('.sticky-note').forEach(note => {
    const handles = note.querySelectorAll('.note-title, .note-header-row');
    if (handles.length === 0) return;
    handles.forEach(handle => {
      handle.addEventListener('dblclick', (e) => {
        if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON') return;
        expandNote(note);
      });
    });
  });

  function isOverlapping(r1, r2) {
    return !(r1.right < r2.left ||
      r1.left > r2.right ||
      r1.bottom < r2.top ||
      r1.top > r2.bottom);
  }

  function makeDraggable(element) {
    let isDragging = false;
    let mouseX = 0, mouseY = 0;
    let currentX = 0, currentY = 0;
    let velocityX = 0;
    let animationFrameId;
    let startMouseX, startMouseY;
    let isActive = false;

    // Only drag from title / header row
    const dragHandles = element.querySelectorAll('.note-title, .note-header-row');
    if (dragHandles.length > 0) {
      dragHandles.forEach(h => { h.onmousedown = dragMouseDown; h.ontouchstart = dragMouseDown; });
    } else {
      element.onmousedown = dragMouseDown;
    }

    function dragMouseDown(e) {
      e = e || window.event;
      e.preventDefault();

      highestZIndex++;
      element.style.zIndex = highestZIndex;
      element.classList.remove('animating');

      isDragging = false;
      isActive = true;
      let dragStarted = false;

      currentX = element.offsetLeft;
      currentY = element.offsetTop;

      const offsetX = e.clientX - currentX;
      const offsetY = e.clientY - currentY;

      mouseX = currentX;
      mouseY = currentY;

      startMouseX = e.clientX;
      startMouseY = e.clientY;

      document.onmouseup = closeDragElement;
      document.onmousemove = (e) => {
        e.preventDefault();
        const dist = Math.hypot(e.clientX - startMouseX, e.clientY - startMouseY);
        if (!dragStarted && dist > 4) {
          dragStarted = true;
          isDragging = true;
          element.classList.add('is-dragging');
        }
        mouseX = e.clientX - offsetX;
        mouseY = e.clientY - offsetY;
      };

      if (!animationFrameId) {
        updatePhysics();
      }
    }

    function updatePhysics() {
      if (!isActive) return;

      const lerpFactor = 0.15;

      const nextX = currentX + (mouseX - currentX) * lerpFactor;
      const nextY = currentY + (mouseY - currentY) * lerpFactor;

      velocityX = nextX - currentX;
      currentX = nextX;
      currentY = nextY;

      element.style.left = currentX + "px";
      element.style.top = currentY + "px";

      if (isDragging) {
        const rotation = Math.max(-10, Math.min(10, velocityX * 0.4));
        element.style.transform = `rotate(${rotation}deg)`;
      }

      if (!isDragging && Math.abs(mouseX - currentX) < 0.1 && Math.abs(mouseY - currentY) < 0.1 && Math.abs(velocityX) < 0.01) {
        isActive = false;
        element.style.transform = 'none';
        animationFrameId = null;
      } else {
        animationFrameId = requestAnimationFrame(updatePhysics);
      }
    }

    function closeDragElement(e) {
      isDragging = false;
      element.classList.remove('is-dragging');
      document.onmouseup = null;
      document.onmousemove = null;

      const rect = element.getBoundingClientRect();
      const heroRect = document.getElementById('floating-hero').getBoundingClientRect();
      const indexRect = document.getElementById('floating-index').getBoundingClientRect();

      if (isOverlapping(rect, heroRect) || isOverlapping(rect, indexRect)) {
        element.style.zIndex = 1000;
      }

      // Allow clicks on links inside sticky notes
      if (e) {
        const dist = Math.hypot(e.clientX - startMouseX, e.clientY - startMouseY);
        if (dist < 5 && e.target.tagName === 'A') {
          e.target.click();
        }
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

  // Are.na gallery
  const arenaNote = document.querySelector('.sticky-arena');
  if (arenaNote) {
    const galleryEl = arenaNote.querySelector('.arena-gallery');
    const captionEl = arenaNote.querySelector('.arena-caption');
    const counterEl = arenaNote.querySelector('.arena-counter');
    const prevBtn = arenaNote.querySelector('.arena-prev');
    const nextBtn = arenaNote.querySelector('.arena-next');
    let arenaBlocks = [];
    let arenaIndex = 0;

    function showArenaBlock(idx) {
      if (arenaBlocks.length === 0) return;
      arenaIndex = idx;
      const block = arenaBlocks[idx];
      const src = block.image.large ? block.image.large.src : block.image.src;
      galleryEl.innerHTML = `<img src="${src}" alt="${block.title || 'Are.na'}">`;

      const blockUrl = `https://www.are.na/block/${block.id}`;
      const sourceUrl = block.source && block.source.url ? block.source.url : null;
      let links = `<a href="${blockUrl}" target="_blank">are.na/block/${block.id}</a>`;
      if (sourceUrl) {
        const hostname = new URL(sourceUrl).hostname.replace('www.', '');
        links += ` · <a href="${sourceUrl}" target="_blank">${hostname}</a>`;
      }
      captionEl.innerHTML = (block.title || '') + (block.title ? '<br>' : '') + links;
      counterEl.textContent = `${idx + 1} / ${arenaBlocks.length}`;
    }

    function fetchArena() {
      fetch('https://api.are.na/v3/channels/two-zero-two-six-2m8-hk_mexy/contents')
        .then(r => r.json())
        .then(res => {
          const blocks = res.data || res;
          arenaBlocks = blocks.filter(b => b.type === 'Image' && b.image).reverse();
          if (arenaBlocks.length === 0) return;
          showArenaBlock(0);
        })
        .catch(() => {
          galleryEl.innerHTML = '<div class="arena-loading">could not load</div>';
        });
    }

    prevBtn.addEventListener('click', () => {
      if (arenaBlocks.length === 0) return;
      showArenaBlock((arenaIndex - 1 + arenaBlocks.length) % arenaBlocks.length);
    });

    nextBtn.addEventListener('click', () => {
      if (arenaBlocks.length === 0) return;
      showArenaBlock((arenaIndex + 1) % arenaBlocks.length);
    });

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
    const W = pongCanvas.width;
    const H = pongCanvas.height;
    const paddleW = 50, paddleH = 6, ballR = 5;
    let p1x = W / 2, p2x = W / 2;
    let bx = W / 2, by = H / 2;
    let bvx = 0, bvy = 0;
    let s1 = 0, s2 = 0;
    let mouseX = W / 2;
    let running = false;
    const s1El = document.getElementById('pong-p1');
    const s2El = document.getElementById('pong-p2');
    const startBtn = document.getElementById('pong-start');
    const stopBtn = document.getElementById('pong-stop');
    const restartBtn = document.getElementById('pong-restart');

    function resetBall(dir) {
      bx = W / 2; by = H / 2;
      bvx = (Math.random() > 0.5 ? 1 : -1) * 2.5;
      bvy = dir * 3;
    }

    function fullReset() {
      running = false;
      s1 = 0; s2 = 0;
      s1El.textContent = '0'; s2El.textContent = '0';
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
        // Player paddle
        p1x += (mouseX - p1x) * 0.25;
        p1x = Math.max(paddleW / 2, Math.min(W - paddleW / 2, p1x));

        // AI paddle
        const aiTarget = bx + (bvy < 0 ? bvx * ((paddleH + 10 - by) / (bvy || 1)) : 0);
        p2x += (aiTarget - p2x) * 0.06;
        p2x = Math.max(paddleW / 2, Math.min(W - paddleW / 2, p2x));

        // Ball
        bx += bvx; by += bvy;

        // Wall bounce
        if (bx - ballR <= 0 || bx + ballR >= W) bvx = -bvx;

        // Paddle collision — bottom (player)
        if (by + ballR >= H - paddleH - 8 && bvy > 0) {
          if (bx > p1x - paddleW / 2 - ballR && bx < p1x + paddleW / 2 + ballR) {
            bvy = -bvy;
            bvx += (bx - p1x) * 0.1;
            by = H - paddleH - 8 - ballR;
          }
        }

        // Paddle collision — top (AI)
        if (by - ballR <= paddleH + 8 && bvy < 0) {
          if (bx > p2x - paddleW / 2 - ballR && bx < p2x + paddleW / 2 + ballR) {
            bvy = -bvy;
            bvx += (bx - p2x) * 0.1;
            by = paddleH + 8 + ballR;
          }
        }

        // Score
        if (by > H + ballR) { s2++; s2El.textContent = s2; resetBall(-1); }
        if (by < -ballR) { s1++; s1El.textContent = s1; resetBall(1); }

        // Speed cap
        bvx = Math.max(-6, Math.min(6, bvx));

        drawFrame();
      }

      requestAnimationFrame(pongLoop);
    }

    // Draw initial stopped frame
    drawFrame();
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
