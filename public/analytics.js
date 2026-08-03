/*
 * Push or Pay analytics: GA4 + PostHog.
 * - Client-side keys (GA4 measurement id, PostHog project key) are PUBLIC by design —
 *   they identify the destination, they are not secrets. Safe to ship in the page.
 * - Only runs in production (not localhost / not file://) so local dev never pollutes data.
 * - Single-init guard; GA4's automatic pageview is left on (standard for a small static site).
 * - PostHog stays dormant until POSTHOG_KEY is filled in — set it to the Push or Pay
 *   PostHog project's "Project API Key" (starts with phc_) and it activates on next deploy.
 */
(function () {
  var GA4_ID = 'G-T1D42K3BBF';
  var POSTHOG_KEY = ''; // <-- paste the Push or Pay PostHog Project API Key (phc_...) here
  var POSTHOG_HOST = 'https://us.i.posthog.com';

  function isProduction() {
    if (location.protocol === 'file:') return false;
    if (['localhost', '127.0.0.1', ''].includes(location.hostname)) return false;
    return true;
  }

  function initGA4(id) {
    if (!id || window.gtag) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', id);
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
    document.head.appendChild(s);
  }

  function initPostHog(apiKey, apiHost) {
    if (!apiKey || window.posthog) return;
    /* eslint-disable */
    !(function (t, e) {
      var o, n, p, r;
      e.__SV ||
        ((window.posthog = e),
        (e._i = []),
        (e.init = function (i, s, a) {
          function g(t, e) {
            var o = e.split('.');
            2 == o.length && ((t = t[o[0]]), (e = o[1])),
              (t[e] = function () {
                t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
              });
          }
          ((p = t.createElement('script')).type = 'text/javascript'),
            (p.async = !0),
            (p.src = s.api_host + '/static/array.js'),
            (r = t.getElementsByTagName('script')[0]).parentNode.insertBefore(p, r);
          var u = e;
          for (
            void 0 !== a ? (u = e[a] = []) : (a = 'posthog'),
              u.people = u.people || [],
              u.toString = function (t) {
                var e = 'posthog';
                return 'posthog' !== a && (e += '.' + a), t || (e += ' (stub)'), e;
              },
              u.people.toString = function () {
                return u.toString(1) + '.people (stub)';
              },
              o =
                'capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures'.split(
                  ' '
                ),
              n = 0;
            n < o.length;
            n++
          )
            g(u, o[n]);
          e._i.push([i, s, a]);
        }),
        (e.__SV = 1));
    })(document, window.posthog || []);
    window.posthog.init(apiKey, { api_host: apiHost || 'https://us.i.posthog.com' });
    /* eslint-enable */
  }

  function trackEvent(name, props) {
    if (window.posthog) window.posthog.capture(name, props || {});
    if (window.gtag) window.gtag('event', name, props || {});
  }

  function init() {
    if (window.__analyticsInitialized) return; // single-flight guard
    if (!isProduction()) return;
    window.__analyticsInitialized = true;
    initGA4(GA4_ID);
    initPostHog(POSTHOG_KEY, POSTHOG_HOST);
    window.trackEvent = trackEvent;
  }

  window.Analytics = { init: init, trackEvent: trackEvent };
  init();
})();
