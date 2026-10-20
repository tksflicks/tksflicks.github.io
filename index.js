// Flag JS support right away so the gallery fade-in styles only apply when this script runs
document.documentElement.classList.add('js');

$(function() {
    'use strict';

    // ——— Galleries are built from folders ———
    // A gallery is <div class="row gallery" data-folder="landscape"></div>.
    // It shows every photo in media/<data-folder>/ (and its subfolders), in filename order.
    // Album pages (gallery/?folder=portrait) show a card for each subfolder instead.
    // To add photos: drop them in a folder, run `python tools/make_web_images.py`, push.
    // The photo list (window.PHOTOS) comes from media/web/photos.js, written by that script.

    var COLUMN_COUNT = 4;
    // Tells the browser how wide a grid image is at each breakpoint so it picks 600w or 1200w
    var GRID_SIZES = '(max-width: 650px) 100vw, (max-width: 1000px) 50vw, 25vw';
    var SWIPE_THRESHOLD = 50;
    var REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var PHOTOS = window.PHOTOS || {};
    // media/ path relative to this page, taken from where photos.js was loaded ("./media/" or "../media/")
    var photosScript = document.querySelector('script[src$="web/photos.js"]');
    var MEDIA_BASE = photosScript ? photosScript.getAttribute('src').replace(/web\/photos\.js$/, '') : './media/';

    // Photos in a folder, including its subfolders
    function photosIn(folder) {
        var prefix = folder ? folder.replace(/\/+$/, '') + '/' : '';
        return Object.keys(PHOTOS).filter(function(rel) {
            return rel.indexOf(prefix) === 0;
        });
    }

    function subfoldersOf(folder) {
        var prefix = folder + '/';
        var seen = {};
        Object.keys(PHOTOS).forEach(function(rel) {
            if (rel.indexOf(prefix) !== 0) return;
            var rest = rel.slice(prefix.length);
            if (rest.indexOf('/') !== -1) seen[prefix + rest.split('/')[0]] = true;
        });
        return Object.keys(seen).sort();
    }

    // Display names for the top-level folders; everything else is prettified from the folder name
    var FOLDER_NAMES = { portrait: 'Portraits', landscape: 'Landscapes' };

    // "band_photos" -> "Band Photos"
    function prettyName(folder) {
        if (FOLDER_NAMES[folder]) return FOLDER_NAMES[folder];
        return folder.split('/').pop().split(/[_-]+/).map(function(w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
    }

    // Card cover: a photo named cover.jpg in the folder if there is one, else its first photo
    function coverFor(folder) {
        var photos = photosIn(folder);
        return photos.filter(function(rel) { return /\/cover\.[^/]+$/i.test(rel); })[0] || photos[0];
    }


    // ——— Album page: gallery/?folder=portrait or gallery/?folder=portrait/band_photos ———

    var album = document.querySelector('.album');
    if (album) renderAlbum(album);

    function renderAlbum(el) {
        var folder = (new URLSearchParams(location.search).get('folder') || '').replace(/^\/+|\/+$/g, '');
        var parent = folder.indexOf('/') === -1 ? '' : folder.slice(0, folder.lastIndexOf('/'));
        var subs = folder ? subfoldersOf(folder) : [];
        var total = folder ? photosIn(folder).length : 0;
        var title = folder ? prettyName(folder) : 'Portfolio';

        document.title = title + ' | TK Flicks';
        $(el).find('.album-back').attr('href', parent ? '?folder=' + encodeURIComponent(parent) : '../portfolio/');
        $(el).find('.album-title').text(title);
        $(el).find('.album-count').text(
            !total ? 'Nothing here yet.' :
            subs.length ? subs.length + (subs.length === 1 ? ' album' : ' albums') + ' · ' + total + ' photos' :
            total + (total === 1 ? ' photo' : ' photos'));

        // One card per subfolder
        var cards = $(el).find('.album-cards');
        subs.forEach(function(sub) {
            var cover = coverFor(sub);
            var count = photosIn(sub).length;
            $('<a class="album-card"></a>')
                .attr('href', '?folder=' + encodeURIComponent(sub))
                .append($('<span class="album-card-img"></span>').append($('<img>').attr({
                    src: webSrc(cover, 600),
                    srcset: encodeURI(webSrc(cover, 600)) + ' 600w, ' + encodeURI(webSrc(cover, 1200)) + ' 1200w',
                    sizes: '(max-width: 650px) 100vw, (max-width: 1000px) 50vw, 33vw',
                    loading: 'lazy',
                    alt: ''
                })))
                .append($('<span class="album-card-title"></span>').text(prettyName(sub)))
                .append($('<span class="album-card-count"></span>').text(count + (count === 1 ? ' photo' : ' photos')))
                .appendTo(cards);
        });
        if (!subs.length) cards.remove();

        // Photos only on albums without subfolders; category pages (portrait, landscape) show cards.
        // Loose photos next to subfolders (e.g. a portfolio cover image) aren't listed.
        var grid = $(el).find('.gallery');
        if (!total || subs.length) grid.remove();
        else grid.attr('data-folder', folder);
    }

    var gallery = $('.gallery');
    if (!gallery.length) return;

    /**
     * Fills a gallery from its data-folder. Each photo goes into the currently
     * shortest column (heights known from photos.js), so columns stay balanced
     * and the order reads left-to-right, top-to-bottom.
     * Keeps the structure: .section > .row.gallery > .column > img
     */
    function populateGallery(row) {
        var folder = row.getAttribute('data-folder');
        if (!folder) return;
        // Several folders (data-folder="landscape, portrait") are mixed one album at a time
        var photos = folder.indexOf(',') === -1 ? photosIn(folder) : mixAlbums(folder.split(',').map(function(f) { return f.trim(); }));

        var cols = [], heights = [];
        for (var c = 0; c < COLUMN_COUNT; c++) {
            cols.push($('<div class="column"></div>').appendTo(row));
            heights.push(0);
        }
        photos.forEach(function(rel) {
            var shortest = heights.indexOf(Math.min.apply(null, heights));
            var size = PHOTOS[rel];
            cols[shortest].append(galleryImg(rel));
            heights[shortest] += size[1] / size[0];
        });
    }

    // Takes one photo from each album in turn, so a mixed gallery isn't one album after another
    function mixAlbums(folders) {
        var albums = {}, order = [];
        folders.forEach(function(f) {
            photosIn(f).forEach(function(rel) {
                var album = rel.slice(0, rel.lastIndexOf('/'));
                if (!albums[album]) { albums[album] = []; order.push(album); }
                albums[album].push(rel);
            });
        });
        var mixed = [];
        var longest = Math.max.apply(null, order.map(function(album) { return albums[album].length; }));
        for (var i = 0; i < longest; i++) {
            order.forEach(function(album) {
                if (albums[album][i]) mixed.push(albums[album][i]);
            });
        }
        return mixed;
    }

    // web-sized copy made by tools/make_web_images.py, e.g. media/web/Folder/name-600.jpg
    function webSrc(rel, width) {
        return MEDIA_BASE + 'web/' + rel.replace(/\.[^.]+$/, '') + '-' + width + '.jpg';
    }

    function galleryImg(rel) {
        var size = PHOTOS[rel];
        return $('<img>').attr({
            src: webSrc(rel, 600),
            srcset: encodeURI(webSrc(rel, 600)) + ' 600w, ' + encodeURI(webSrc(rel, 1200)) + ' 1200w',   // srcset breaks on raw spaces
            sizes: GRID_SIZES,
            // width/height let the browser reserve space, so lazy loading works without layout jumps
            width: size[0],
            height: size[1],
            loading: 'lazy',
            alt: '',
            'data-large': webSrc(rel, 2000),
            'data-original': MEDIA_BASE + rel
        });
    }

    gallery.each(function() { populateGallery(this); });

    var all_imgs = gallery.find('.column img');
    all_imgs.attr({ tabindex: 0, role: 'button', decoding: 'async' })
        .each(function() {
            if (!this.getAttribute('aria-label')) this.setAttribute('aria-label', 'View photo');
        });


    // ——— Reveal-on-scroll: fade images in once they're loaded and on screen ———

    var revealQueue = [];
    var revealTimer = null;

    // Stagger images that enter the viewport together so they cascade in
    function flushReveal() {
        revealQueue.forEach(function(img, i) {
            img.style.transitionDelay = REDUCED_MOTION ? '0ms' : Math.min(i * 70, 420) + 'ms';
            img.classList.add('is-visible');
        });
        revealQueue = [];
        revealTimer = null;
    }

    var revealObserver = 'IntersectionObserver' in window
        ? new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (!entry.isIntersecting) return;
                revealObserver.unobserve(entry.target);
                revealQueue.push(entry.target);
            });
            if (revealQueue.length && !revealTimer) revealTimer = setTimeout(flushReveal, 30);
        }, { rootMargin: '0px 0px -40px 0px' })
        : null;

    function watchForReveal(img) {
        if (revealObserver) revealObserver.observe(img);
        else img.classList.add('is-visible');
    }

    // Images that fail to load are left out of the viewer
    all_imgs.each(function() {
        var img = this;
        if (img.complete) {
            if (!img.naturalWidth) img.classList.add('is-broken');
            watchForReveal(img);
        } else {
            $(img).one('load error', function(e) {
                if (e.type === 'error') img.classList.add('is-broken');
                watchForReveal(img);
            });
        }
    });

    // Clear the stagger delay after the fade so hover transitions stay snappy
    gallery.on('transitionend', '.column img', function(e) {
        if (e.originalEvent.propertyName === 'opacity') this.style.transitionDelay = '';
    });


    // ——— Lightbox ———

    var ICONS = {
        close: '<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>',
        prev: '<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M640-80 240-480l400-400 71 71-329 329 329 329-71 71Z"/></svg>',
        next: '<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="m321-80-71-71 329-329-329-329 71-71 400 400L321-80Z"/></svg>',
        fullscreen: '<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M120-120v-200h80v120h120v80H120Zm520 0v-80h120v-120h80v200H640ZM120-640v-200h200v80H200v120h-80Zm640 0v-120H640v-80h200v200h-80Z"/></svg>',
        open: '<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h560v-280h80v280q0 33-23.5 56.5T760-120H200Zm188-212-56-56 372-372H560v-80h280v280h-80v-144L388-332Z"/></svg>'
    };

    var modal = $(
        '<div class="img-modal" role="dialog" aria-modal="true" aria-label="Photo viewer" aria-hidden="true">' +
            '<div class="modal-topbar">' +
                '<span class="modal-counter" aria-live="polite"></span>' +
                '<div class="modal-actions">' +
                    '<a class="modal-btn" data-action="open" target="_blank" rel="noopener" aria-label="Open full-size image" title="Open full size">' + ICONS.open + '</a>' +
                    '<button type="button" class="modal-btn" data-action="fullscreen" aria-label="Toggle fullscreen" title="Fullscreen (F)">' + ICONS.fullscreen + '</button>' +
                    '<button type="button" class="modal-btn" data-action="close" aria-label="Close" title="Close (Esc)">' + ICONS.close + '</button>' +
                '</div>' +
            '</div>' +
            '<button type="button" class="modal-nav modal-prev" data-action="prev" aria-label="Previous photo" title="Previous (←)">' + ICONS.prev + '</button>' +
            '<div class="modal-stage">' +
                '<div class="modal-spinner" aria-hidden="true"></div>' +
                '<img class="modal-img" alt="">' +
            '</div>' +
            '<button type="button" class="modal-nav modal-next" data-action="next" aria-label="Next photo" title="Next (→)">' + ICONS.next + '</button>' +
            '<div class="modal-strip" aria-label="All photos"></div>' +
        '</div>'
    ).appendTo('body');

    var stage = modal.find('.modal-stage');
    var modalImg = modal.find('.modal-img');
    var counter = modal.find('.modal-counter');
    var strip = modal.find('.modal-strip');
    var openLink = modal.find('[data-action="open"]');

    var order = [];          // gallery <img> elements in visual reading order
    var current_ind = 0;
    var loadToken = 0;       // guards against out-of-order loads when clicking fast
    var lastFocused = null;
    var isOpen = false;

    /**
     * Sort images top-to-bottom, then left-to-right, using their on-screen position.
     * This matches what the visitor sees at any column count (4, 2 or 1), so the
     * arrows always move to the photo that looks "next" — no per-breakpoint math.
     */
    function computeOrder() {
        return all_imgs.toArray()
            .filter(function(img) {
                return img.offsetParent !== null && !img.classList.contains('is-broken');
            })
            .map(function(img) {
                var r = img.getBoundingClientRect();
                return { img: img, top: Math.round(r.top), left: Math.round(r.left) };
            })
            .sort(function(a, b) { return (a.top - b.top) || (a.left - b.left); })
            .map(function(o) { return o.img; });
    }

    function buildStrip() {
        strip.empty();
        order.forEach(function(img, i) {
            $('<button type="button" class="modal-thumb"></button>')
                .attr({ 'data-index': i, 'aria-label': 'Photo ' + (i + 1) })
                .append($('<img alt="" loading="lazy">').attr('src', img.src))   // smallest (600w) copy
                .appendTo(strip);
        });
    }

    // Viewer uses the 2000px copy when there is one, else whatever the grid shows
    function srcAt(i) {
        var img = order[i];
        return img ? (img.getAttribute('data-large') || img.currentSrc || img.src) : '';
    }

    function originalAt(i) {
        var img = order[i];
        return img ? (img.getAttribute('data-original') || srcAt(i)) : '';
    }

    function preload(i) {
        var src = srcAt((i + order.length) % order.length);
        if (src) new Image().src = src;
    }

    /**
     * Shows image i. dir is -1 / 1 for the slide direction, 0 for no slide.
     */
    function show(i, dir) {
        if (!order.length) return;
        current_ind = (i + order.length) % order.length;   // wrap around at the ends
        var src = srcAt(current_ind);
        var token = ++loadToken;

        setZoom(false);
        counter.text((current_ind + 1) + ' / ' + order.length);
        openLink.attr('href', originalAt(current_ind));

        strip.find('.modal-thumb').removeClass('is-active').attr('aria-current', null)
            .eq(current_ind).addClass('is-active').attr('aria-current', 'true')
            .each(function() { scrollThumbIntoView(this); });

        stage.attr('data-dir', dir > 0 ? 'next' : dir < 0 ? 'prev' : 'none').addClass('is-switching');

        var next = new Image();
        next.src = src;
        var ready = next.decode ? next.decode().catch(function() {}) : Promise.resolve();
        var spinnerTimer = setTimeout(function() { stage.addClass('is-loading'); }, 150);

        // Wait for both the outgoing fade and the decode, then swap and fade back in
        var fadeOut = new Promise(function(resolve) {
            setTimeout(resolve, REDUCED_MOTION || !dir ? 0 : 160);
        });
        Promise.all([ready, fadeOut]).then(function() {
            clearTimeout(spinnerTimer);
            if (token !== loadToken) return;
            modalImg.attr('src', src);
            stage.removeClass('is-loading');
            requestAnimationFrame(function() { stage.removeClass('is-switching'); });
        });

        preload(current_ind + 1);
        preload(current_ind - 1);
    }

    function scrollThumbIntoView(thumb) {
        var s = strip[0];
        var target = thumb.offsetLeft - (s.clientWidth - thumb.offsetWidth) / 2;
        s.scrollTo({ left: target, behavior: REDUCED_MOTION ? 'auto' : 'smooth' });
    }

    function openModal(img) {
        order = computeOrder();
        buildStrip();
        lastFocused = document.activeElement;

        // Stop the page shifting when the scrollbar disappears
        var scrollbar = window.innerWidth - document.documentElement.clientWidth;
        document.documentElement.style.setProperty('--scrollbar-gap', scrollbar + 'px');
        $('html').addClass('modal-open');

        isOpen = true;
        modal.attr('aria-hidden', 'false').addClass('is-open');
        show(Math.max(0, order.indexOf(img)), 0);
        modal.find('[data-action="close"]').trigger('focus');
    }

    function closeModal() {
        if (!isOpen) return;
        isOpen = false;
        if (document.fullscreenElement) document.exitFullscreen().catch(function() {});
        setZoom(false);
        modal.removeClass('is-open').attr('aria-hidden', 'true');
        $('html').removeClass('modal-open');
        if (lastFocused) lastFocused.focus({ preventScroll: true });
    }

    function toggleFullscreen() {
        if (!document.fullscreenEnabled) return;
        if (document.fullscreenElement) document.exitFullscreen();
        else modal[0].requestFullscreen().catch(function() {});
    }

    // Click-to-zoom on precise pointers: zooms toward the click and pans with the mouse
    var canZoom = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    function setZoom(on, e) {
        stage.toggleClass('is-zoomed', !!on);
        if (on && e) panTo(e);
        if (!on) modalImg.css('transform-origin', '');
    }

    function panTo(e) {
        var r = modalImg[0].getBoundingClientRect();
        var x = ((e.clientX - r.left) / r.width) * 100;
        var y = ((e.clientY - r.top) / r.height) * 100;
        modalImg.css('transform-origin', Math.max(0, Math.min(100, x)) + '% ' + Math.max(0, Math.min(100, y)) + '%');
    }


    // ——— Events ———

    gallery.on('click', '.column img', function(e) {
        e.preventDefault();
        openModal(this);
    });

    gallery.on('keydown', '.column img', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openModal(this);
        }
    });

    modal.on('click', '[data-action]', function(e) {
        var action = $(this).data('action');
        if (action === 'open') return;   // let the link work normally
        e.stopPropagation();
        if (action === 'close') closeModal();
        else if (action === 'prev') show(current_ind - 1, -1);
        else if (action === 'next') show(current_ind + 1, 1);
        else if (action === 'fullscreen') toggleFullscreen();
    });

    strip.on('click', '.modal-thumb', function(e) {
        e.stopPropagation();
        var i = +$(this).data('index');
        if (i !== current_ind) show(i, i > current_ind ? 1 : -1);
    });

    // Clicking the dark backdrop (not the photo or controls) closes the viewer
    modal.on('click', function(e) {
        if (e.target === modal[0] || e.target === stage[0]) closeModal();
    });

    modalImg.on('click', function(e) {
        if (!canZoom) return;
        setZoom(!stage.hasClass('is-zoomed'), e);
    });

    modalImg.on('mousemove', function(e) {
        if (stage.hasClass('is-zoomed')) panTo(e);
    });

    $(document).on('keydown', function(e) {
        if (!isOpen) return;
        switch (e.key) {
            case 'Escape':
                // Let the browser leave fullscreen first; a second Esc closes
                if (!document.fullscreenElement) closeModal();
                break;
            case 'ArrowLeft':  e.preventDefault(); show(current_ind - 1, -1); break;
            case 'ArrowRight': e.preventDefault(); show(current_ind + 1, 1); break;
            case 'Home':       e.preventDefault(); show(0, -1); break;
            case 'End':        e.preventDefault(); show(order.length - 1, 1); break;
            case 'f': case 'F': toggleFullscreen(); break;
            case 'Tab': trapFocus(e); break;
        }
    });

    function trapFocus(e) {
        var focusable = modal.find('button, a[href]').filter(':visible').toArray();
        if (!focusable.length) return;
        var first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    // Touch: swipe left/right to navigate, swipe down to close
    var touchStart = null;

    stage.on('touchstart', function(e) {
        var t = e.originalEvent.touches;
        touchStart = t.length === 1 ? { x: t[0].clientX, y: t[0].clientY } : null;
    });

    stage.on('touchmove', function(e) {
        if (!touchStart || e.originalEvent.touches.length !== 1) return;
        var t = e.originalEvent.touches[0];
        var dx = t.clientX - touchStart.x;
        var dy = t.clientY - touchStart.y;
        // Follow the finger a little for feedback
        stage.addClass('is-dragging');
        if (Math.abs(dx) > Math.abs(dy)) modalImg.css('transform', 'translateX(' + dx * 0.4 + 'px)');
        else if (dy > 0) modalImg.css({ transform: 'translateY(' + dy * 0.5 + 'px)', opacity: Math.max(0.3, 1 - dy / 400) });
    });

    stage.on('touchend touchcancel', function(e) {
        stage.removeClass('is-dragging');
        modalImg.css({ transform: '', opacity: '' });
        if (!touchStart) return;
        var t = e.originalEvent.changedTouches[0];
        var dx = t.clientX - touchStart.x;
        var dy = t.clientY - touchStart.y;
        touchStart = null;

        if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) show(current_ind + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
        else if (dy > SWIPE_THRESHOLD * 2) closeModal();
    });
});
