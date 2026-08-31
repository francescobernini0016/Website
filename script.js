document.addEventListener('DOMContentLoaded', () => {
  const images = document.querySelectorAll('.draggable');
  const randomImages = Array.from(images).filter(el => !el.classList.contains('sticky-scatter'));
  let highestZIndex = 100;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Center images initially, then scatter with animation
  randomImages.forEach(img => {
    const imgHeight = img.offsetHeight || 200;
    const imgWidth = img.offsetWidth || 200;
    img.style.top = `${(viewportHeight * 0.8 - imgHeight) / 2}px`;
    img.style.left = `${(viewportWidth - imgWidth) / 2}px`;
    img.classList.add('animating');
  });

  setTimeout(() => {
    randomizePositions(randomImages, window.innerWidth, window.innerHeight * 0.8);
    setTimeout(() => {
      randomImages.forEach(img => img.classList.remove('animating'));
    }, 1000);
  }, 100);

  randomImages.forEach(img => makeDraggable(img));

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

  function wrapBtnLetters() {
    if (!gridBtn) return;
    const text = gridBtn.textContent;
    gridBtn.innerHTML = text.split('').map(ch =>
      `<span class="btn-letter">${ch === ' ' ? '&nbsp;' : ch}</span>`
    ).join('');
  }

  // Notes to arrange — never the Organize button itself, so it stays put and clickable
  function getGalleryNotes() {
    return Array.from(document.querySelectorAll('.gallery .draggable'))
      .filter(n => !n.classList.contains('sticky-scatter'));
  }

  function scatterNotes(notes) {
    notes.forEach(n => n.classList.add('animating'));
    randomizePositions(notes, window.innerWidth, window.innerHeight * 0.8);
    setTimeout(() => notes.forEach(n => n.classList.remove('animating')), 1000);
  }

  function organizeNotes(notes) {
    // Tight grid / masonry packing
    const hero = document.getElementById('floating-hero');
    const heroRect = hero ? hero.getBoundingClientRect() : { bottom: 0, right: 0, left: 0, top: 0, width: 0, height: 0 };
    const heroBg = document.getElementById('hero-bg');
    const heroBgRect = heroBg ? heroBg.getBoundingClientRect() : { bottom: 0, top: 0, height: 0 };
    const startX = Math.max(heroRect.right + 30, 40);
    const startY = Math.max(heroBgRect.bottom + 30, 60);
    const gap = 14;
    const maxX = window.innerWidth - 30;
    const placed = []; // {x, y, w, h}

    // Block the floating hero, the hero-bg caption area, and the Organize button
    if (hero) {
      placed.push({ x: heroRect.left - gap, y: heroRect.top - gap, w: heroRect.width + gap * 2, h: heroRect.height + gap * 2 });
    }
    if (heroBg) {
      placed.push({ x: 0, y: heroBgRect.top - gap, w: window.innerWidth, h: heroBgRect.height + gap * 2 });
    }
    const scatterBtn = document.querySelector('.sticky-scatter');
    if (scatterBtn) {
      const sr = scatterBtn.getBoundingClientRect();
      placed.push({ x: sr.left - gap, y: sr.top - gap, w: sr.width + gap * 2, h: sr.height + gap * 2 });
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

    const step = 8;
    const areaBottom = window.innerHeight;
    let overflowCascade = 0;

    sorted.forEach(n => {
      n.classList.add('animating');
      const w = n.offsetWidth || 260;
      const h = n.offsetHeight || 200;
      const bw = w + gap;
      const bh = h + gap;
      let bestX = startX, bestY = startY;
      let found = false;

      // Scan candidate positions top-to-bottom, left-to-right; pick first fit
      for (let ty = startY; ty < areaBottom - h; ty += step) {
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

      if (!found) {
        // No room left in the visible area — cascade diagonally so notes stay
        // visible/clickable instead of piling on the exact same spot
        bestX = Math.min(startX + overflowCascade * 26, Math.max(startX, maxX - w));
        bestY = Math.min(startY + overflowCascade * 26, Math.max(startY, areaBottom - h));
        overflowCascade++;
      }

      n.style.top = bestY + 'px';
      n.style.left = bestX + 'px';
      n.style.transform = 'none';
      n.style.visibility = 'visible';

      placed.push({ x: bestX, y: bestY, w: bw, h: bh });
    });

    setTimeout(() => notes.forEach(n => n.classList.remove('animating')), 1000);
  }

  if (gridBtn) {
    gridBtn.addEventListener('click', () => {
      const notes = getGalleryNotes();
      if (isGridded) {
        scatterNotes(notes);
        gridBtn.textContent = 'Organize';
        isGridded = false;
      } else {
        organizeNotes(notes);
        gridBtn.textContent = 'Scatter';
        isGridded = true;
      }
    });
  }

  const topBtn = document.getElementById('top-btn');
  if (topBtn) {
    topBtn.addEventListener('click', () => {
      const hero = document.getElementById('hero');
      if (hero) hero.scrollIntoView({ behavior: 'smooth' });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    const heroSection = document.getElementById('hero');
    if (heroSection) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) {
            topBtn.classList.remove('hiding');
            topBtn.classList.add('visible');
          } else {
            topBtn.classList.remove('visible');
            topBtn.classList.add('hiding');
            topBtn.addEventListener('animationend', () => topBtn.classList.remove('hiding'), { once: true });
          }
        },
        { threshold: 0 }
      );
      observer.observe(heroSection);
    }
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

  // Debounced resize handler — keep the current mode (organized vs scattered) in sync
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const notes = getGalleryNotes();
      if (isGridded) organizeNotes(notes);
      else scatterNotes(notes);
    }, 200);
  });

  // Generate floating index links
  const indexContainer = document.getElementById('index-content');
  indexContainer.innerHTML = '';

  const projects = document.querySelectorAll('.project-section');
  projects.forEach(project => {
    const titleEl = project.querySelector('h2') || project.querySelector('.proj-col1 div:last-child');
    const title = titleEl ? titleEl.textContent.trim() : project.id;
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
      fetch('https://api.are.na/v2/channels/two-zero-two-six-2m8-hk_mexy/contents?per=100')
        .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(res => {
          const blocks = Array.isArray(res) ? res : (res.contents || res.data || []);
          const imageBlocks = blocks.filter(b => (b.class === 'Image' || b.type === 'Image') && b.image).reverse();

          if (imageBlocks.length === 0) {
            galleryEl.innerHTML = '<div class="arena-loading">no images</div>';
            return;
          }

          galleryEl.innerHTML = '';
          imageBlocks.forEach(block => {
            const img = block.image;
            const src = (img.large && img.large.url)
              || (img.display && img.display.url)
              || (img.original && img.original.url)
              || (img.square && img.square.url);
            if (!src) return;
            const slide = document.createElement('div');
            slide.classList.add('arena-slide');
            slide.innerHTML = `<img src="${src}" alt="${block.title || 'Are.na'}">`;
            galleryEl.appendChild(slide);
          });

          updateArenaCounter();
        })
        .catch(err => {
          galleryEl.innerHTML = `<div class="arena-loading">${err.message || 'could not load'}</div>`;
        });
    }

    function currentArenaIdx() {
      const slides = galleryEl.querySelectorAll('.arena-slide');
      if (!slides.length) return 0;
      return Math.round(galleryEl.scrollLeft / (slides[0].offsetWidth + 6));
    }

    function arenaScrollTo(idx) {
      const slides = galleryEl.querySelectorAll('.arena-slide');
      if (!slides.length) return;
      idx = Math.max(0, Math.min(idx, slides.length - 1));
      galleryEl.scrollTo({ left: idx * (slides[0].offsetWidth + 6), behavior: 'smooth' });
    }

    const arenaPrevBtn = arenaNote.querySelector('.arena-prev');
    const arenaNextBtn = arenaNote.querySelector('.arena-next');
    if (arenaPrevBtn) arenaPrevBtn.addEventListener('click', () => arenaScrollTo(currentArenaIdx() - 1));
    if (arenaNextBtn) arenaNextBtn.addEventListener('click', () => arenaScrollTo(currentArenaIdx() + 1));

    galleryEl.addEventListener('scroll', updateArenaCounter);
    fetchArena();
    setInterval(fetchArena, 60000);
  }

  // Recipe navigation
  document.querySelectorAll('.sticky-recipe').forEach(note => {
    const slides = note.querySelectorAll('.recipe-slide');
    const titleEl = note.querySelector('.recipe-name-title');
    const prevBtn = note.querySelector('.recipe-prev');
    const nextBtn = note.querySelector('.recipe-next');
    let currentIndex = 0;

    function showRecipe(idx) {
      slides.forEach(s => s.style.display = 'none');
      slides[idx].style.display = '';
      titleEl.textContent = slides[idx].dataset.recipe;
      currentIndex = idx;
    }

    prevBtn.addEventListener('click', () => showRecipe((currentIndex - 1 + slides.length) % slides.length));
    nextBtn.addEventListener('click', () => showRecipe((currentIndex + 1) % slides.length));
    showRecipe(0);
  });

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

  // Controls note: letter scatter on hover
  (function () {
    const btn = document.getElementById('grid-btn');
    if (!btn) return;

    wrapBtnLetters();
    btn.addEventListener('click', () => setTimeout(wrapBtnLetters, 0));

    let animating = false;
    btn.addEventListener('mouseenter', () => {
      if (animating) return;
      animating = true;
      const noteBody = btn.closest('.note-body');
      const bodyRect = noteBody.getBoundingClientRect();
      const letters = btn.querySelectorAll('.btn-letter');

      letters.forEach(letter => {
        const rx = (Math.random() - 0.5) * bodyRect.width * 0.75;
        const ry = (Math.random() - 0.5) * bodyRect.height * 0.75;
        const rot = (Math.random() - 0.5) * 90;
        letter.style.transition = 'transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)';
        letter.style.transform = `translate(${rx}px, ${ry}px) rotate(${rot}deg)`;
      });

      setTimeout(() => {
        btn.querySelectorAll('.btn-letter').forEach(letter => {
          letter.style.transition = 'transform 0.55s cubic-bezier(0.25, 1, 0.5, 1)';
          letter.style.transform = '';
        });
        setTimeout(() => { animating = false; }, 600);
      }, 380);
    });
  })();

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
    // Use hero-bg (the visible caption bar) as the top exclusion boundary
    const heroBg = document.getElementById('hero-bg');
    const heroBgRect = heroBg ? heroBg.getBoundingClientRect() : null;
    const topMin = heroBgRect ? Math.ceil(heroBgRect.bottom) + 20 : 160;

    const margin = 20;
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
        randomTop = topMin + Math.floor(Math.random() * Math.max(10, viewportHeight - imgHeight - topMin - edgePad));
        randomLeft = edgePad + Math.floor(Math.random() * (viewportWidth - imgWidth - edgePad * 2));

        if (randomTop < 0) randomTop = edgePad;
        if (randomLeft < 0) randomLeft = edgePad;

        isValidPosition = true;

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
