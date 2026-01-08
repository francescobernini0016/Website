document.addEventListener('DOMContentLoaded', () => {
  const images = document.querySelectorAll('.draggable');
  let highestZIndex = 100; // Start higher than other elements

  // Floating Cards Logic (Hero Bio) - now handled by generic snippets logic below
  // Initial startup: Center -> Random
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // 1. Set initial positions to center
  images.forEach(img => {
    const imgHeight = img.offsetHeight || 200;
    const imgWidth = img.offsetWidth || 200;
    img.style.top = `${(viewportHeight - imgHeight) / 2}px`;
    img.style.left = `${(viewportWidth - imgWidth) / 2}px`;
    img.classList.add('animating'); // Enable transition
  });

  // 2. Randomize after a brief delay to allow DOM to render center pos
  setTimeout(() => {
    randomizePositions(images, window.innerWidth, window.innerHeight);

    // 3. Remove animation class after transition finishes (1s)
    setTimeout(() => {
      images.forEach(img => img.classList.remove('animating'));
    }, 1000);
  }, 100);

  // Make images draggable
  images.forEach(img => {
    makeDraggable(img);
  });

  function makeDraggable(element) {
    let isDragging = false;
    let mouseX = 0, mouseY = 0;
    let currentX = 0, currentY = 0;
    let velocityX = 0;
    let animationFrameId; // To stop loop if needed, though we usually keep it running if active
    let startMouseX, startMouseY;
    let isActive = false; // Track if this specific element is active

    // Initialize current positions from style or offset
    // This needs to be robust if style is empty initially (handled in startup logic)

    element.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      e = e || window.event;
      e.preventDefault();

      // Bring to front immediately and permanently
      highestZIndex++;
      element.style.zIndex = highestZIndex;

      // Visual feedback
      element.classList.remove('animating'); // Stop CSS transitions
      element.style.cursor = 'grabbing';

      // Update state
      isDragging = true;
      isActive = true;

      // Get current position
      currentX = element.offsetLeft;
      currentY = element.offsetTop;

      // Target follows mouse exactly relative to grab point
      // We calculate the offset from the element's top-left
      const offsetX = e.clientX - currentX;
      const offsetY = e.clientY - currentY;

      // Initialize target (mouseX/Y) to current position so there's no initial jump
      mouseX = currentX;
      mouseY = currentY;

      // For click detection
      startMouseX = e.clientX;
      startMouseY = e.clientY;

      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;

      function elementDrag(e) {
        e.preventDefault();
        // Update target position
        mouseX = e.clientX - offsetX;
        mouseY = e.clientY - offsetY;
      }

      // Start the physics loop if not already running
      if (!animationFrameId) {
        updatePhysics();
      }
    }

    function updatePhysics() {
      if (!isActive) return; // Stop loop if satisfied

      // Physics Parameters
      // Higher lerp = tighter control (less sloppy), Lower = more weight/lag
      const lerpFactor = 0.15; // Increased from 0.1 for tighter feel

      // Interpolate
      const nextX = currentX + (mouseX - currentX) * lerpFactor;
      const nextY = currentY + (mouseY - currentY) * lerpFactor;

      // Velocity for sway
      velocityX = nextX - currentX;

      // Update current
      currentX = nextX;
      currentY = nextY;

      // Apply
      element.style.left = currentX + "px";
      element.style.top = currentY + "px";

      // Sway Logic
      // Smoother sway: clamp and reduce intensity
      const rotation = Math.max(-10, Math.min(10, velocityX * 0.4));
      const scale = isDragging ? 1.05 : 1.0; // Scale up only when holding

      element.style.transform = `rotate(${rotation}deg) scale(${scale})`;

      // Continue loop
      // We can stop loop when "close enough" and not dragging, but simpler to keep running while interaction is hot
      // optimization: stop if !isDragging and velocity is near zero
      if (!isDragging && Math.abs(mouseX - currentX) < 0.1 && Math.abs(mouseY - currentY) < 0.1 && Math.abs(velocityX) < 0.01) {
        isActive = false; // Stop loop
        element.style.transform = 'rotate(0deg) scale(1)'; // Ensure clean reset
        animationFrameId = null;
      } else {
        animationFrameId = requestAnimationFrame(updatePhysics);
      }
    }

    function closeDragElement(e) {
      isDragging = false;
      document.onmouseup = null;
      document.onmousemove = null;
      element.style.cursor = 'grab';

      // Check Overlap with UI (re-use existing logic if possible or re-implement)
      const rect = element.getBoundingClientRect();
      const heroRect = document.getElementById('floating-hero').getBoundingClientRect();
      const indexRect = document.getElementById('floating-index').getBoundingClientRect();

      function isOverlapping(r1, r2) {
        return !(r1.right < r2.left ||
          r1.left > r2.right ||
          r1.bottom < r2.top ||
          r1.top > r2.bottom);
      }

      // If overlapping UI, push behind
      if (isOverlapping(rect, heroRect) || isOverlapping(rect, indexRect)) {
        element.style.zIndex = 1000;
      }
      // Else leave at highestZIndex (already set at mousedown)

      // Click Detection
      if (e) {
        const dist = Math.hypot(e.clientX - startMouseX, e.clientY - startMouseY);
        if (dist < 5) {
          const targetId = element.getAttribute('data-target');
          if (targetId) {
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
              targetSection.scrollIntoView({ behavior: 'smooth' });
            }
          }
        }
      }
    }
  }

  // Handle resize with debounce
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      images.forEach(img => img.classList.add('animating'));
      randomizePositions(images, window.innerWidth, window.innerHeight);

      // Remove class after transition
      setTimeout(() => {
        images.forEach(img => img.classList.remove('animating'));
      }, 1000);
    }, 200); // Wait 200ms after resize stops
  });

  // Order button removed

  // Generate Floating Index
  const indexContainer = document.getElementById('index-content');
  indexContainer.innerHTML = ''; // Clear existing content

  // Add Project Links
  const projects = document.querySelectorAll('.project-section');
  projects.forEach((project, i) => {
    const title = project.querySelector('h2').textContent;
    const link = document.createElement('a');
    link.textContent = title;
    link.addEventListener('click', () => {
      project.scrollIntoView({ behavior: 'smooth' });
    });
    indexContainer.appendChild(link);
  });

  // Expandable Project Captions (Click on text)
  const projectDetails = document.querySelectorAll('.project-details');
  projectDetails.forEach(detail => {
    detail.addEventListener('click', () => {
      const section = detail.closest('.project-section');
      section.classList.toggle('expanded');
    });
  });

  // Project Navigation Bar
  const navBar = document.getElementById('project-nav-bar');
  if (navBar) {
    // Sort images by data-target to ensure consistent order or use DOM order
    // Using existing 'images' NodeList
    images.forEach(img => {
      const title = img.querySelector('img').alt;
      const targetId = img.getAttribute('data-target');

      const navItem = document.createElement('span');
      navItem.textContent = title;
      navItem.classList.add('nav-item');
      navItem.setAttribute('data-target', targetId);

      navBar.appendChild(navItem);

      // Click Nav -> Scroll to Project
      navItem.addEventListener('click', () => {
        const targetSection = document.getElementById(targetId);
        if (targetSection) {
          targetSection.scrollIntoView({ behavior: 'smooth' });
        }
      });

      // Hover Nav -> Highlight Image
      navItem.addEventListener('mouseenter', () => {
        img.classList.add('highlight');
      });
      navItem.addEventListener('mouseleave', () => {
        img.classList.remove('highlight');
      });

      // Hover Image -> Highlight Nav
      img.addEventListener('mouseenter', () => {
        navItem.classList.add('active');
        // Also bring image to front visualy if not dragging
        img.style.zIndex = 1500;
      });
      img.addEventListener('mouseleave', () => {
        navItem.classList.remove('active');
        // Reset z-index if needed, or let the drag logic handle stacking order
        // We'll leave it high to prevent flickering or let next click fix it
        // A safe bet is to restore to a high "normal" or just remove the override if styles handled it
        if (!img.classList.contains('highlight')) {
          // img.style.zIndex = ''; // This might push it behind others if stacks are high
          // Actually, styles.css handles z-index for .highlight
        }
      });
    });
  }

  // Collapse Logic
  // Collapse Logic
  const indexExpandBtn = document.getElementById('index-expand-btn');
  // Snippet Expansion Logic (Bio + Projects)
  const snippets = document.querySelectorAll('.box-content'); // Targets bio and projects

  snippets.forEach(snippet => {
    snippet.addEventListener('click', (e) => {
      // Prevent triggering if clicking links inside
      if (e.target.tagName === 'A') return;

      if (snippet.classList.contains('animating')) return; // Debounce
      snippet.classList.add('animating');

      // 1. Fade out content to hide reflow
      snippet.classList.add('content-hidden');

      // 2. Wait for fade/prep (short delay) then toggle expansion
      setTimeout(() => {
        snippet.classList.toggle('expanded');
        snippet.classList.toggle('snippet');

        // 3. Wait for width/flex transition (0.6s) to finish, then fade back in
        setTimeout(() => {
          snippet.classList.remove('content-hidden');
          snippet.classList.remove('animating');
        }, 10); // Match CSS transition duration
      }, 10); // Short delay to allow fade-out start
    });
  });

  const indexListContainer = document.getElementById('index-list-container');
  const floatingHero = document.getElementById('floating-hero');
  const floatingIndex = document.getElementById('floating-index');

  function toggleBoxContent(content) {
    content.classList.toggle('collapsed');
  }

  // heroExpandBtn was removed

  indexExpandBtn.addEventListener('click', () => {
    toggleBoxContent(indexListContainer);
  });


  // Slideshow Navigation (Arrows)
  const sliders = document.querySelectorAll('.slideshow');
  sliders.forEach(slider => {
    // Create Container
    const container = document.createElement('div');
    container.classList.add('slideshow-container');

    // Insert container before slider
    slider.parentNode.insertBefore(container, slider);

    // Move slider into container
    container.appendChild(slider);

    // Create Buttons
    const prevBtn = document.createElement('button');
    prevBtn.classList.add('nav-btn', 'prev');
    prevBtn.textContent = '←';

    const nextBtn = document.createElement('button');
    nextBtn.classList.add('nav-btn', 'next');
    nextBtn.textContent = '→';

    // Insert Buttons
    container.insertBefore(prevBtn, slider);
    container.appendChild(nextBtn);

    // Function to update button visibility
    const updateButtonVisibility = () => {
      // Hide Prev button if at start
      if (slider.scrollLeft <= 0) {
        prevBtn.classList.add('hidden');
      } else {
        prevBtn.classList.remove('hidden');
      }

      // Hide Next button if at end
      // Allow a small buffer (1px) for calculation errors
      if (slider.scrollLeft + slider.clientWidth >= slider.scrollWidth - 1) {
        nextBtn.classList.add('hidden');
      } else {
        nextBtn.classList.remove('hidden');
      }
    };

    // Initial check
    updateButtonVisibility();

    // Update on scroll
    slider.addEventListener('scroll', updateButtonVisibility);

    // Update on window load (images loaded)
    window.addEventListener('load', updateButtonVisibility);

    // Update on resize (layout changes)
    const resizeObserver = new ResizeObserver(() => {
      updateButtonVisibility();
    });
    resizeObserver.observe(slider);

    // Generate Counter
    const slides = slider.querySelectorAll('img, video');
    const totalSlides = slides.length;

    // Safety check for empty sliders
    if (totalSlides > 0) {
      const counter = document.createElement('div');
      counter.classList.add('slide-counter');
      counter.textContent = `1/${totalSlides}`;
      container.appendChild(counter);

      // Intersection Observer to track visible slide
      const observerOptions = {
        root: slider,
        threshold: 0.5 // Trigger when 50% of slide is visible
      };

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            // Find index of intersecting slide
            const index = Array.from(slides).indexOf(entry.target);
            if (index !== -1) {
              counter.textContent = `${index + 1}/${totalSlides}`;
            }
          }
        });
      }, observerOptions);

      slides.forEach(slide => observer.observe(slide));
    }

    // Event Listeners for clicks
    prevBtn.addEventListener('click', () => {
      slider.scrollBy({ left: -slider.clientWidth, behavior: 'smooth' });
    });

    nextBtn.addEventListener('click', () => {
      slider.scrollBy({ left: slider.clientWidth, behavior: 'smooth' });
    });
  });


});

// orderImages function removed

function randomizePositions(images, viewportWidth, viewportHeight) {
  const isMobile = viewportWidth < 768;

  if (isMobile) {
    // Mobile: Vertical Stack
    const bio = document.getElementById('bio');
    const bioRect = bio.getBoundingClientRect();
    let currentTop = bioRect.bottom + 20; // Start 20px below text
    const overlapFactor = 0.4; // 40% overlap

    images.forEach((img, index) => {
      const imgWidth = img.offsetWidth || 200;
      const imgHeight = img.offsetHeight || 200;

      // Center horizontally
      const leftPos = (viewportWidth - imgWidth) / 2;

      // Stack vertically
      img.style.top = `${currentTop}px`;
      img.style.left = `${leftPos}px`;
      img.style.transform = 'none';
      img.style.visibility = 'visible';

      // Ensure correct stacking order
      img.style.zIndex = 10 + index;

      // Increment top for next image (height - overlap)
      currentTop += imgHeight * (1 - overlapFactor);
    });

  } else {
    // Desktop: Random Scatter
    const minTop = 50;
    const minLeft = 50;
    const maxOverlap = 0.25;
    const maxAttempts = 50;

    images.forEach((img, index) => {
      const imgHeight = img.offsetHeight || 200;
      const imgWidth = img.offsetWidth || 200;

      let randomTop, randomLeft;
      let isValidPosition = false;
      let attempts = 0;

      // Try to find a valid random position
      while (!isValidPosition && attempts < maxAttempts) {
        attempts++;
        randomTop = Math.floor(Math.random() * (viewportHeight - imgHeight - minTop));
        randomLeft = Math.floor(Math.random() * (viewportWidth - imgWidth - minLeft));

        if (randomTop < 0) randomTop = 0;
        if (randomLeft < 0) randomLeft = 0;

        isValidPosition = true;

        for (let i = 0; i < images.length; i++) {
          if (i === index) continue;

          const otherImg = images[i];
          // Use current style target for overlap check, not computed style which might be animating
          const otherTop = parseInt(otherImg.style.top) || 0;
          const otherLeft = parseInt(otherImg.style.left) || 0;
          const otherHeight = otherImg.offsetHeight || 200;
          const otherWidth = otherImg.offsetWidth || 200;

          const overlapHeight = Math.max(0, Math.min(randomTop + imgHeight, otherTop + otherHeight) - Math.max(randomTop, otherTop));
          const overlapWidth = Math.max(0, Math.min(randomLeft + imgWidth, otherLeft + otherWidth) - Math.max(randomLeft, otherLeft));
          const overlapArea = overlapHeight * overlapWidth;
          const imageArea = imgWidth * imgHeight;
          const otherImageArea = otherWidth * otherHeight;

          if (overlapArea > maxOverlap * imageArea || overlapArea > maxOverlap * otherImageArea) {
            isValidPosition = false;
            break;
          }
        }
      }

      // Apply new position (no rotation)
      img.style.top = `${randomTop}px`;
      img.style.left = `${randomLeft}px`;
      img.style.transform = 'none'; // Reset any previous rotation
      img.style.visibility = 'visible';
    });
  }
}
