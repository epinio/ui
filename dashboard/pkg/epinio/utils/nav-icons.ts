
const NAV_ICONS: Record<string, string> = {
  'Dashboard': 'gauge',
  'Applications': 'table',
  'Namespaces': 'list',
  'Services': 'rocket',
  'Advanced': 'folderPlus',
  'System': 'gears',
  'Instances': 'database',
  'Catalog': 'shoppingBag',
  'Configurations': 'sliders',
  'Application Charts': 'chartLine',
  'About': 'info',
};

let navObserver: MutationObserver | null = null;

function injectIcons() {
  if (!window.location.pathname.includes('epinio')) {
    // remove icons if we navigate away from epinio
    document.querySelectorAll('.side-nav trailhand-icon').forEach(icon => icon.remove());
    return;
  };
  // top level nav items
  document.querySelectorAll('.side-nav a.type-link').forEach((link) => {
    const label = link.querySelector('.label');
    const text = label?.textContent?.trim();

    if (!text || !NAV_ICONS[text]) return;
    if (link.querySelector('trailhand-icon')) return; // already injected

    const icon = document.createElement('trailhand-icon');
    icon.setAttribute('name', NAV_ICONS[text]);
    icon.style.fontSize = '16px';
    link.prepend(icon);
  });

  // group headers (Services, Advanced, System)
  document.querySelectorAll('.side-nav .accordion .header').forEach((header) => {
    const text = header.querySelector('span')?.textContent?.trim();

    if (!text || !NAV_ICONS[text]) return;
    if (header.querySelector('trailhand-icon')) return;

    const icon = document.createElement('trailhand-icon');
    icon.setAttribute('name', NAV_ICONS[text]);
    icon.style.fontSize = '16px';
    header.querySelector('h6')?.prepend(icon);
  });
}

export function initNavIcons() {
  if (navObserver) return; // prevent duplicates

  navObserver = new MutationObserver(() => injectIcons());

  navObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

  injectIcons();
}