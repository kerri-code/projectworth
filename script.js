
    document.addEventListener('DOMContentLoaded', function () {
      function updateTabState() {
        var hash = window.location.hash || '#home';
        document.body.classList.toggle('tab-active', hash !== '#home' && hash !== '');
      }
      updateTabState();
      window.addEventListener('hashchange', updateTabState);

      var revealItems = document.querySelectorAll('.reveal-on-scroll');
      if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          });
        }, { threshold: 0.12 });
        revealItems.forEach(function (item, index) {
          item.style.transitionDelay = Math.min(index * 0.035, 0.22) + 's';
          observer.observe(item);
        });
      } else { revealItems.forEach(function (item) { item.classList.add('is-visible'); }); }
      document.querySelectorAll('.compare-slider-shell').forEach(function (shell) {
        var input = shell.querySelector('.compare-range');
        var update = function (value) { shell.style.setProperty('--slider-position', value + '%'); };
        if (input) { input.addEventListener('input', function () { update(input.value); }); update(input.value || 50); }
      });
    });
  


    document.addEventListener('DOMContentLoaded', function () {
      var quoteCard = document.querySelector('.sunflower-section .quote-card');
      var symbolCard = document.querySelector('.sunflower-section .symbol-card');
      if (!('IntersectionObserver' in window)) {
        if (quoteCard) quoteCard.classList.add('is-glowing');
        if (symbolCard) symbolCard.classList.add('glow-active');
        return;
      }

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            if (entry.target === quoteCard) entry.target.classList.add('is-glowing');
            if (entry.target === symbolCard) entry.target.classList.add('glow-active');
          } else {
            if (entry.target === quoteCard) entry.target.classList.remove('is-glowing');
            if (entry.target === symbolCard) entry.target.classList.remove('glow-active');
          }
        });
      }, { threshold: 0.45 });

      if (quoteCard) observer.observe(quoteCard);
      if (symbolCard) observer.observe(symbolCard);
    });
  


    document.addEventListener('DOMContentLoaded', function () {
      var flashcards = document.querySelectorAll('.grooming-accordion-grid .flashcard');
      flashcards.forEach(function (card) {
        var button = card.querySelector('.flashcard-header');
        if (!button) return;
        button.addEventListener('click', function () {
          var isActive = card.classList.contains('active');
          flashcards.forEach(function (otherCard) {
            otherCard.classList.remove('active');
            var otherButton = otherCard.querySelector('.flashcard-header');
            if (otherButton) otherButton.setAttribute('aria-expanded', 'false');
          });
          if (!isActive) {
            card.classList.add('active');
            button.setAttribute('aria-expanded', 'true');
          }
        });
      });

      var revealSigns = document.querySelectorAll('.grooming-accordion-grid .reveal-sign');
      if ('IntersectionObserver' in window) {
        var signObserver = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              signObserver.unobserve(entry.target);
            }
          });
        }, { threshold: 0.18 });
        revealSigns.forEach(function (card) { signObserver.observe(card); });
      } else {
        revealSigns.forEach(function (card) { card.classList.add('is-visible'); });
      }
    });
  


  document.addEventListener('DOMContentLoaded', function () {
    var cards = document.querySelectorAll('.interactive-star-card');
    if (!cards.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    cards.forEach(function (card) {
      var stars = card.querySelectorAll('.interactive-star');
      card.addEventListener('mousemove', function (event) {
        var rect = card.getBoundingClientRect();
        var relX = (event.clientX - rect.left) / rect.width - 0.5;
        var relY = (event.clientY - rect.top) / rect.height - 0.5;
        stars.forEach(function (star, index) {
          var strength = 8 + index * 2;
          star.style.setProperty('--star-x', (relX * strength).toFixed(2) + 'px');
          star.style.setProperty('--star-y', (relY * strength).toFixed(2) + 'px');
        });
      });
      card.addEventListener('mouseleave', function () {
        stars.forEach(function (star) {
          star.style.setProperty('--star-x', '0px');
          star.style.setProperty('--star-y', '0px');
        });
      });
    });
  });



  document.addEventListener('DOMContentLoaded', function () {
    function markLoadedImage(img, loadedClassTarget) {
      function mark() {
        if (img.naturalWidth && img.naturalHeight && img.style.display !== 'none') {
          loadedClassTarget.classList.add('image-loaded');
          var carousel = loadedClassTarget.closest('.media-bts-carousel');
          if (carousel) carousel.classList.add('image-loaded');
        }
      }
      function unmark() {
        loadedClassTarget.classList.remove('image-loaded');
      }
      if (img.complete && img.naturalWidth) mark();
      img.addEventListener('load', mark);
      img.addEventListener('error', unmark);
    }

    document.querySelectorAll('.media-static-photo-slot img').forEach(function (img) {
      var slot = img.closest('.media-static-photo-slot');
      if (slot) markLoadedImage(img, slot);
    });

    document.querySelectorAll('.media-bts-slide img').forEach(function (img) {
      var slide = img.closest('.media-bts-slide');
      if (slide) markLoadedImage(img, slide);
    });
  });



  document.addEventListener('DOMContentLoaded', function () {
    var contactForm = document.getElementById('project-worth-contact-form');
    var statusMessage = document.getElementById('contact-form-status');
    if (!contactForm) return;

    contactForm.addEventListener('submit', function (event) {
      event.preventDefault();

      var endpoint = contactForm.getAttribute('action');
      if (!endpoint || endpoint.indexOf('YOUR_API_GATEWAY_INVOKE_URL') !== -1) {
        if (statusMessage) {
          statusMessage.textContent = 'Contact form endpoint is not connected yet. Please email info@projectworthwi.org.';
          statusMessage.style.color = '#a87d1f';
          statusMessage.style.fontWeight = '800';
        }
        return;
      }

      var submitButton = contactForm.querySelector('button[type="submit"]');
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Sending...';
      }
      if (statusMessage) {
        statusMessage.textContent = 'Sending your message...';
      }

      var formData = new FormData(contactForm);
      var payload = {};
      formData.forEach(function (value, key) { payload[key] = value; });

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(function (response) {
        if (!response.ok) throw new Error('Form submission failed');
        window.location.href = '/thank-you.html';
      })
      .catch(function () {
        if (statusMessage) {
          statusMessage.textContent = 'Something went wrong. Please email info@projectworthwi.org directly.';
          statusMessage.style.color = '#a87d1f';
          statusMessage.style.fontWeight = '800';
        }
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Send Message';
        }
      });
    });
  });



(function () {
  const carousel = document.querySelector('#press .media-bts-carousel');
  if (!carousel) return;

  const slides = Array.from(carousel.querySelectorAll('.media-bts-slide'));
  const dots = Array.from(carousel.querySelectorAll('.media-bts-dot'));
  const prev = carousel.querySelector('[data-media-bts-prev]');
  const next = carousel.querySelector('[data-media-bts-next]');

  if (!slides.length) return;

  let current = slides.findIndex(slide => slide.classList.contains('is-active'));
  if (current < 0) current = 0;

  function setSlide(index) {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => slide.classList.toggle('is-active', i === current));
    dots.forEach((dot, i) => dot.classList.toggle('active', i === current));
  }

  let backdrop = document.querySelector('.media-bts-pop-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'media-bts-pop-backdrop';
    document.body.appendChild(backdrop);
  }

  let panel = document.querySelector('.media-bts-pop-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'media-bts-pop-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    document.body.appendChild(panel);
  }

  function closePanel() {
    panel.classList.remove('is-visible');
    backdrop.classList.remove('is-visible');
  }

  function openPanel(button) {
    const index = Number(button.dataset.btsLearn || current || 0);
    setSlide(index);

    const title = button.dataset.title || 'Behind the Scenes';
    const body = (button.dataset.body || '').split('||').filter(Boolean);

    panel.innerHTML =
      '<button class="media-bts-pop-close" type="button" aria-label="Close">×</button>' +
      '<div class="media-bts-pop-scroll">' +
      '<h4>' + title + '</h4>' +
      body.map(text => '<p>' + text + '</p>').join('') +
      '</div>';

    panel.classList.add('is-visible');
    backdrop.classList.add('is-visible');

    const close = panel.querySelector('.media-bts-pop-close');
    if (close) close.addEventListener('click', closePanel);
  }

  if (prev) {
    prev.addEventListener('click', function (event) {
      event.preventDefault();
      setSlide(current - 1);
    });
  }

  if (next) {
    next.addEventListener('click', function (event) {
      event.preventDefault();
      setSlide(current + 1);
    });
  }

  dots.forEach((dot, index) => {
    dot.addEventListener('click', function (event) {
      event.preventDefault();
      setSlide(index);
    });
  });

  carousel.addEventListener('click', function (event) {
    const learn = event.target.closest('.media-bts-learn');
    if (!learn || !carousel.contains(learn)) return;
    event.preventDefault();
    openPanel(learn);
  });

  backdrop.addEventListener('click', closePanel);

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closePanel();
  });

  setSlide(current);
})();



(function () {
  const decks = Array.from(document.querySelectorAll('#advocacy .reporting-flashcards-side'));
  if (!decks.length) return;

  decks.forEach(function (deck) {
    const slides = Array.from(deck.querySelectorAll('.rf-slide'));
    const prev = deck.querySelector('.rf-carousel-arrow.left');
    const next = deck.querySelector('.rf-carousel-arrow.right');
    const current = deck.querySelector('.rf-current');
    const total = deck.querySelector('.rf-total');

    if (!slides.length || !prev || !next) return;

    let index = slides.findIndex(slide => slide.classList.contains('is-active'));
    if (index < 0) index = 0;

    if (total) total.textContent = slides.length;

    function showSlide(newIndex) {
      slides[index].classList.remove('is-active');
      slides[index].removeAttribute('open');
      index = (newIndex + slides.length) % slides.length;
      slides[index].classList.add('is-active');
      if (current) current.textContent = index + 1;
    }

    prev.addEventListener('click', function (event) {
      event.preventDefault();
      showSlide(index - 1);
    });

    next.addEventListener('click', function (event) {
      event.preventDefault();
      showSlide(index + 1);
    });

    slides.forEach(function (slide) {
      slide.addEventListener('toggle', function () {
        if (!slide.open) return;
        slides.forEach(function (other) {
          if (other !== slide) other.removeAttribute('open');
        });
      });
    });

    showSlide(index);
  });
})();


/* Shared footer include */
document.addEventListener('DOMContentLoaded', function () {
  var footerTargets = document.querySelectorAll('[data-include="footer"]');
  if (!footerTargets.length) return;

  fetch('footer.html', { cache: 'no-cache' })
    .then(function (response) {
      if (!response.ok) throw new Error('Footer include failed: ' + response.status);
      return response.text();
    })
    .then(function (html) {
      footerTargets.forEach(function (target) {
        target.outerHTML = html;
      });
    })
    .catch(function () {
      footerTargets.forEach(function (target) {
        target.innerHTML = '<footer><div class="container footer-bottom"><p>Project Worth is a 501(c)(3) nonprofit organization.</p><p><a href="transparency.html">Transparency</a></p><p>© 2026 Project Worth, Inc. All rights reserved.</p></div></footer>';
      });
    });
});
