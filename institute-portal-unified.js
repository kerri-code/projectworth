
/*
 * PROJECT WORTH | INSTITUTE PORTAL
 * File: institute-portal.js
 *
 * Works with the separated Institute pages (My Learning, My Department,
 * Profile) while keeping Home, Calendar, Our People, and Admin in the portal.
 * It displays verified account information without writing or deleting
 * course progress, profiles, assignments, or confidential records.
 *
 * Access control belongs on the AWS API, NOT in this browser script.
 */
(() => {
  'use strict';

  if (window.__projectWorthPortalScriptLoaded) return;
  window.__projectWorthPortalScriptLoaded = true;

  const API = 'https://t0pckriwia.execute-api.us-east-2.amazonaws.com';

  const PATHS = Object.freeze({
    home: 'institute-portal.html',
    login: 'institute-login.html',
    learning: 'my-learning.html',
    department: 'my-department.html',
    profile: 'my-profile.html',
    foundations: 'light-the-way-foundations.html',
    leadership: 'leadership-training.html',
    facilitator: 'light-the-way-facilitator.html'
  });

  const $ = id => document.getElementById(id);

  const liveSite = /^(www\.)?projectworthwi\.org$/i.test(location.hostname);

  const session = key => {
    try {
      return sessionStorage.getItem(key) || '';
    } catch (_) {
      return '';
    }
  };

  const token = session('pwInstituteIdToken');
  const expires = Number(session('pwInstituteExpiresAt')) || 0;
  const signedIn = Boolean(token && expires > Date.now() + 10000);

  function clearSession() {
    [
      'pwInstituteAccessToken',
      'pwInstituteIdToken',
      'pwInstituteRefreshToken',
      'pwInstituteExpiresAt'
    ].forEach(key => {
      try {
        sessionStorage.removeItem(key);
      } catch (_) {
        /* no-op */
      }
    });
  }

  function navigate(path, replace = false) {
    if (replace) {
      location.replace(path);
    } else {
      location.assign(path);
    }
  }

  function setText(id, value) {
    const node = $(id);
    if (node) {
      node.textContent = value == null ? '' : String(value);
    }
  }

  function show(id, visible) {
    const node = $(id);
    if (node) {
      node.hidden = !visible;
    }
  }

  function displayableName(value) {
    const str = String(value || '').trim();

    return str &&
      str.length < 100 &&
      /[A-Za-z]/.test(str) &&
      !str.includes('@') &&
      !/^[0-9a-f-]{20,}$/i.test(str);
  }

  function tokenClaims(jwt) {
    try {
      const middle = jwt.split('.')[1];
      if (!middle) return {};

      const raw = atob(
        middle.replace(/-/g, '+')
          .replace(/_/g, '/')
          .padEnd(Math.ceil(middle.length / 4) * 4, '=')
      );

      const utf8 = Array.from(
        raw,
        char => '%' + char.charCodeAt(0).toString(16).padStart(2, '0')
      ).join('');

      return JSON.parse(decodeURIComponent(utf8));
    } catch (_) {
      return {};
    }
  }

  const claims = signedIn ? tokenClaims(token) : {};

  const accountId =
    claims.sub ||
    claims['cognito:username'] ||
    'preview';

  const optionalProfileKey = 'pwPortalOptionalProfile:' + accountId;

  const user = {
    name: displayableName(claims.name) ? claims.name : 'Team Member',
    role: 'Awaiting assignment',
    department: 'To be assigned',
    leadName: 'To be assigned',
    isLeader: false,
    isAdmin: false,
    verified: false,
    data: {}
  };

  function localPreferences() {
    try {
      const value = JSON.parse(
        localStorage.getItem(optionalProfileKey) || '{}'
      );

      return value &&
        typeof value === 'object' &&
        !Array.isArray(value)
        ? value
        : {};
    } catch (_) {
      return {};
    }
  }

  function currentDisplayName() {
    const prefs = localPreferences();

    return displayableName(prefs.preferredName)
      ? prefs.preferredName
      : user.name;
  }

  async function getRecord(path) {
    if (!signedIn) {
      throw new Error('Sign in to load your account.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(API + path, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + token,
          Accept: 'application/json'
        },
        signal: controller.signal,
        cache: 'no-store'
      });

      if (response.status === 401) {
        clearSession();

        if (liveSite) {
          navigate(PATHS.login, true);
        }

        throw new Error('Your sign-in has expired.');
      }

      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }

      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  function applyVerifiedProfile(response) {
    if (!response || typeof response !== 'object') return;

    // Keep top-level access flags when the API wraps profile details.
    const data = response.profile &&
      typeof response.profile === 'object'
      ? { ...response, ...response.profile }
      : response;

    const fullName = [
      data.firstName || data.given_name,
      data.lastName || data.family_name
    ].filter(displayableName).join(' ');

    if (displayableName(fullName)) {
      user.name = fullName;
    } else if (displayableName(data.name)) {
      user.name = data.name;
    }

    user.role = String(
      data.role || data.position || user.role
    );

    user.department = String(
      data.department || data.team || user.department
    );

    user.leadName = String(
      data.departmentTeamLead || data.teamLead || user.leadName
    );

    const access = String(
      data.accessLevel || data.access || ''
    ).toLowerCase();

    const permissions = (
      Array.isArray(data.permissions) ? data.permissions : []
    ).map(item => String(item).toUpperCase());

    // pw-20261018-cognito-admin-tab-fix
    // Cognito groups are the source of truth for portal role visibility.
    // The backend still validates every privileged API action.
    const rawGroups = claims['cognito:groups'];
    const cognitoGroups = Array.isArray(rawGroups)
      ? rawGroups
      : typeof rawGroups === 'string'
        ? rawGroups.split(',').map(group => group.replace(/[\[\]"']/g, '').trim())
        : [];

    // These values determine visibility only.
    // The server must independently authorize every request.
    user.isAdmin =
      cognitoGroups.includes('PW-FullAdmin') ||
      data.isAdmin === true ||
      data.isOrganizationAdmin === true ||
      [
        'admin',
        'administrator',
        'organization_admin',
        'org_admin'
      ].includes(access) ||
      permissions.some(p =>
        ['FULL_ADMIN', 'ADMIN', 'ORG_ADMIN'].includes(p)
      );

    user.isLeader =
      user.isAdmin ||
      cognitoGroups.includes('PW-Leadership') ||
      cognitoGroups.includes('PW-DepartmentLead') ||
      data.isTeamLead === true ||
      data.isLeader === true ||
      data.isDepartmentLead === true ||
      [
        'leadership',
        'leader',
        'team_lead',
        'department_lead'
      ].includes(access) ||
      permissions.some(p =>
        [
          'DEPARTMENT_LEAD',
          'TEAM_LEAD',
          'LEADERSHIP'
        ].includes(p)
      );

    // A server-assigned leadership position also qualifies
    // for visible leadership training.
    if (
      !user.isLeader &&
      /\b(ceo|president|vice president|vp|director|team lead|department lead|chair)\b/i
        .test(user.role)
    ) {
      user.isLeader = true;
    }

    user.verified = true;
    user.data = data;
  }

  /*
   * ==========================================================
   * PORTAL NAVIGATION
   * ==========================================================
   *
   * Home, Calendar, Our People, Admin and Incident Report
   * can remain in-page panels.
   *
   * My Learning, My Department and Profile use separate
   * HTML pages.
   */

  const inPagePanels = new Set([
    'home',
    'learning',
    'department',
    'calendar',
    'people',
    'admin',
    'incident'
  ]);

  function showPanel(name, updateURL = true) {
    if (!inPagePanels.has(name)) return false;

    if (name === 'admin' && !user.isAdmin) {
      return false;
    }

    if (!document.querySelector(
      '.pw-panel[data-panel="' + name + '"]'
    )) {
      return false;
    }

    document.querySelectorAll(
      '.pw-panel[data-panel]'
    ).forEach(panel => {
      const active = panel.dataset.panel === name;

      panel.hidden = !active;
      panel.classList.toggle('active', active);
      panel.setAttribute('aria-hidden', String(!active));
    });

    document.querySelectorAll(
      '.pw-tab[data-tab]'
    ).forEach(button => {
      const active = button.dataset.tab === name;

      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;

      if (active) {
        button.setAttribute('aria-current', 'page');
      } else {
        button.removeAttribute('aria-current');
      }
    });

    if (updateURL) {
      history.replaceState(null, '', '#' + name);
    }

    if (name === 'people') {
      loadDirectory();
    }

    window.scrollTo({
      top: 0,
      behavior: 'instant'
    });

    return true;
  }

  function goTo(destination) {
    const routes = {
      learning: PATHS.learning,
      forms: PATHS.learning,
      department: PATHS.department,
      lead: PATHS.department,
      resources: PATHS.department,
      profile: PATHS.profile,
      foundations: PATHS.foundations,
      leadership: PATHS.leadership,
      facilitator: PATHS.facilitator
    };

    if (destination === 'learning' || destination === 'department') {
      return showPanel(destination);
    }
    if (routes[destination]) {
      navigate(routes[destination]);
      return true;
    }

    return showPanel(destination);
  }

  function installNavigation() {
    // Capture delegated actions before older tab handlers conflict.
    // Unrelated buttons retain their existing handlers.
    document.addEventListener('click', event => {
      if (!(event.target instanceof Element)) return;

      const control = event.target.closest(
        '[data-tab], [data-go], #onboardingNextButton'
      );

      if (!control) return;

      const dest =
        control.id === 'onboardingNextButton'
          ? 'learning'
          : (control.dataset.go || control.dataset.tab);

      const knownPage = [
        'learning',
        'forms',
        'department',
        'lead',
        'resources',
        'profile',
        'foundations',
        'leadership',
        'facilitator'
      ];

      if (
        !dest ||
        (
          !knownPage.includes(dest) &&
          (
            !inPagePanels.has(dest) ||
            (dest === 'admin' && !user.isAdmin) ||
            !document.querySelector(
              '.pw-panel[data-panel="' + dest + '"]'
            )
          )
        )
      ) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      goTo(dest);
    }, true);

    $('editProfileButton')?.addEventListener('click', () => {
      navigate(PATHS.profile + '#edit');
    });

    $('continueFoundationsButton')?.addEventListener('click', () => {
      navigate(PATHS.foundations);
    });

    $('certificateButton')?.addEventListener('click', () => {
      navigate(PATHS.foundations + '#certificate');
    });

    $('logoutButton')?.addEventListener('click', () => {
      clearSession();
      navigate(PATHS.login, true);
    });

    const requested =
      new URLSearchParams(location.search).get('tab') ||
      location.hash.replace(/^#/, '') ||
      'home';

    if (!showPanel(requested, false)) {
      showPanel('home', false);
    }

    window.addEventListener('hashchange', () => {
      const newPanel =
        location.hash.replace(/^#/, '') || 'home';

      if (!showPanel(newPanel, false)) {
        showPanel('home', false);
      }
    });
  }

  /*
   * ==========================================================
   * PROFILE & DASHBOARD DISPLAY
   * ==========================================================
   */

  function renderProfilePhoto(photoUrl) {
    const avatar = $('homeAvatar');
    const initials = $('homeInitials');
    if (!avatar || !initials) return;

    let image = $('homeProfilePhoto');
    if (!image) {
      image = document.createElement('img');
      image.id = 'homeProfilePhoto';
      image.alt = 'Your Project Worth profile photo';
      image.decoding = 'async';
      image.style.width = '100%';
      image.style.height = '100%';
      image.style.minWidth = '0';
      image.style.maxWidth = '100%';
      image.style.objectFit = 'cover';
      image.style.borderRadius = '50%';
      image.style.gridArea = '1 / 1';
      image.style.display = 'none';
      avatar.style.overflow = 'hidden';
      avatar.appendChild(image);
    }

    // Fill only the unused edge with a soft copy of the same image.
    // The sharp portrait retains its original dashboard framing.
    let backdrop = $('homeProfilePhotoBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('img');
      backdrop.id = 'homeProfilePhotoBackdrop';
      backdrop.alt = '';
      backdrop.setAttribute('aria-hidden', 'true');
      backdrop.decoding = 'async';
      backdrop.style.display = 'none';
      avatar.insertBefore(backdrop, image);
    }

    // Profile editor saves a resized photo as a local data image.
    // Do not accept script-bearing or arbitrary URLs as image sources.
    const source = typeof photoUrl === 'string' &&
      /^data:image\/(jpeg|png|webp);base64,/i.test(photoUrl)
      ? photoUrl : '';

    if (!source) {
      image.removeAttribute('src');
      image.style.display = 'none';
      backdrop.removeAttribute('src');
      backdrop.style.display = 'none';
      initials.hidden = false;
      return;
    }

    image.onload = () => {
      if (image.getAttribute('src') !== source) return;
      image.style.display = 'block';
      backdrop.style.display = 'block';
      initials.hidden = true;
    };
    image.onerror = () => {
      if (image.getAttribute('src') !== source) return;
      image.style.display = 'none';
      backdrop.style.display = 'none';
      initials.hidden = false;
    };

    if (backdrop.getAttribute('src') !== source) {
      backdrop.src = source;
    }

    if (image.getAttribute('src') !== source) {
      image.style.display = 'none';
      backdrop.style.display = 'none';
      initials.hidden = false;
      image.src = source;
    } else if (image.complete && image.naturalWidth > 0) {
      image.style.display = 'block';
      backdrop.style.display = 'block';
      initials.hidden = true;
    }
  }

  function renderProfile() {
    const pref = localPreferences();

    // Verified profile fields take priority.
    // Local values remain a preview fallback.
    const option = key => {
      const approved = user.data[key];

      return approved !== undefined &&
        approved !== null &&
        (
          Array.isArray(approved) ||
          String(approved).trim()
        )
        ? approved
        : pref[key];
    };

    const name = currentDisplayName();
    const firstName = name.split(/\s+/)[0] || 'Team Member';

    const initials = name.split(/\s+/)
      .slice(0, 2)
      .map(word => word.charAt(0).toUpperCase())
      .join('') || 'PW';

    renderProfilePhoto(option('photoUrl'));

    const textFields = {
      heroFirstName: firstName,
      portalUserLabel: name,
      homeName: name,
      homeInitials: initials,
      homeRole: user.role,
      homeRoleLine: user.role + ' • ' + user.department,
      homeDepartment: user.department,
      homeTeamLead: user.leadName,
      homeDepartmentSummary:
        user.department + ' • Team lead: ' + user.leadName,
      homeLocation: option('location'),
      homeHometown: option('hometown'),
      homeCollege: option('college'),
      homeFieldOfStudy: option('fieldOfStudy'),
      homeInterests: Array.isArray(option('interests'))
        ? option('interests').join(', ')
        : option('interests'),
      homeAbout: option('about'),
      homeWhy: option('why'),
      homeMbti: option('mbti'),
      homeEnneagram: option('enneagram'),
      homeAppreciation: option('appreciation')
    };

    Object.entries(textFields).forEach(([id, value]) => {
      if (
        value !== undefined &&
        value !== null &&
        String(value).trim()
      ) {
        setText(id, value);
      }
    });

    const contacts = {
      email: 'Email',
      text: 'Text Message',
      sms: 'Text Message',
      phone: 'Phone Call',
      call: 'Phone Call',
      either: 'Email or Phone',
      both: 'Email or Phone',
      'no-preference': 'No preference',
      'in-person': 'In person'
    };

    const contactMethod = option('contactMethod');

    setText(
      'homeContactMethod',
      contacts[contactMethod] ||
        contactMethod ||
        'Not selected'
    );

    document.querySelectorAll(
      '.pw-admin-only'
    ).forEach(node => {
      node.hidden = !user.isAdmin;
      node.style.display = user.isAdmin ? '' : 'none';
    });

    document.querySelectorAll(
      '.pw-lead-only'
    ).forEach(node => {
      node.hidden = !user.isLeader;
    });

    show('leadershipLearningCard', user.isLeader);

    renderLearningLinks();
    renderOnboarding();
  }

  /*
   * ==========================================================
   * MY LEARNING LINKS
   * ==========================================================
   */

  function addLink(container, label, description, url) {
    const host = $(container);
    if (!host) return;

    const row = document.createElement('div');
    row.className = 'pw-learning-item';

    const a = document.createElement('a');
    a.href = url;
    a.textContent = label + ' →';
    a.style.fontWeight = '800';

    const note = document.createElement('p');
    note.textContent = description;
    note.style.margin = '5px 0 12px';

    row.append(a, note);
    host.appendChild(row);
  }

  function renderLearningLinks() {
    [
      'optionalLearningList',
      'departmentLearningList',
      'leadershipLearningList',
      'learningFormsList'
    ].forEach(id => {
      // These are managed link containers.
      // Never erase unrelated page sections.
      if ($(id)) {
        $(id).replaceChildren();
      }
    });

    addLink(
      'departmentLearningList',
      'My Assigned Courses',
      'View training assigned to your role and department.',
      PATHS.learning
    );

    addLink(
      'learningFormsList',
      'Forms & Commitments',
      'Review required acknowledgments and training forms.',
      PATHS.learning
    );

    addLink(
      'optionalLearningList',
      'Light the Way Facilitator Training',
      'Optional learning to facilitate training in your workplace or community.',
      PATHS.facilitator
    );

    if (user.isLeader) {
      addLink(
        'leadershipLearningList',
        'Project Worth Leadership Training',
        'Servant leadership, communication, boundaries, values, and team support.',
        PATHS.leadership
      );
    }
  }

  /*
   * ==========================================================
   * ONBOARDING & TRAINING STATUS
   * ==========================================================
   */

  function foundationsComplete() {
    const p = user.data;
    const o =
      p.orientation ||
      p.learningRecords?.orientation ||
      {};

    // An issued certificate is the authoritative completion proof used by My Learning.
    return Boolean(p.foundationCertificate?.issuedAt) || (
      o.verified === true &&
      o.assessmentPassed === true &&
      o.agreementSigned === true
    ) || (
      p.foundationsAssessmentPassed === true &&
      Number(p.foundationsCompleted) >= 7
    );
  }

  let leadershipComplete = false;
  let leadershipChecked = false;

  function renderOnboarding() {
    // Do not show a misleading unfinished-training banner while the official
    // member profile is still being fetched.
    if (liveSite && !user.verified) {
      show('onboardingShell', false);
      show('activeMemberBanner', false);
      return;
    }

    const steps = [
      {
        title: 'Institute Account',
        done: user.verified,
        detail: user.verified
          ? 'Your team profile is connected.'
          : 'Verification pending.'
      },
      {
        title: 'Light the Way Foundations',
        done: foundationsComplete(),
        detail: 'Required seven modules, assessment, and commitment.'
      }
    ];

    if (user.isLeader) {
      steps.push({
        title: 'Project Worth Leadership Training',
        done: leadershipComplete,
        detail: leadershipChecked
          ? 'Leadership training and completion record.'
          : 'Open My Learning for the leadership course and progress.'
      });
    }

    const node = $('onboardingSteps');

    if (node) {
      node.replaceChildren();

      steps.forEach(step => {
        const item = document.createElement('div');

        item.className =
          'pw-onboarding-step' +
          (step.done ? ' complete' : ' current');

        const status = document.createElement('span');
        status.className = 'status';
        status.textContent = step.done ? 'Complete' : 'Next step';

        const title = document.createElement('strong');
        title.textContent = step.title;

        const detail = document.createElement('small');
        detail.textContent = step.detail;

        item.append(status, title, detail);
        node.appendChild(item);
      });
    }

    const count = steps.filter(step => step.done).length;
    const allDone = user.verified && count === steps.length;

    if ($('onboardingProgressFill')) {
      $('onboardingProgressFill').style.width =
        Math.round(count / steps.length * 100) + '%';
    }

    setText(
      'onboardingBadge',
      allDone ? 'Complete' : 'In Progress'
    );

    setText(
      'onboardingTitle',
      allDone
        ? 'You are ready to move forward.'
        : 'Finish getting started.'
    );

    setText(
      'onboardingFootNote',
      user.verified
        ? 'Open My Learning to see official learning records and next steps.'
        : 'Your account profile is still being verified. You can open My Learning.'
    );

    show('onboardingShell', !allDone);
    // Training records remain accessible in My Learning after completion.
    // Non-leadership members receive an actionable team connection next step.
    show('activeMemberBanner', allDone && !user.isLeader);
    if (allDone && !user.isLeader) {
      const lead = String(user.leadName || '').trim();
      const assigned = lead && !/^(to be assigned|unassigned|unknown|none|not assigned)$/i.test(lead);
      setText('teamLeadNextStep', assigned
        ? 'Connect with your team lead, ' + lead + ', to plan your first contribution.'
        : 'Connect with your team lead once assigned to plan your first contribution.');
    }
  }

  async function loadLeadershipRecord() {
    if (!user.isLeader || !signedIn) return;

    try {
      const result = await getRecord(
        '/api/leadership-training?status=1'
      );

      const record = result.record || {};

      leadershipComplete =
        record.status === 'completed' ||
        Boolean(record.completedAt);

      leadershipChecked = true;
      renderOnboarding();
    } catch (error) {
      // A missing service never hides the course
      // or erases any progress.
      console.warn(
        'Leadership status unavailable:',
        error.message
      );
    }
  }

  async function loadProfile() {
    if (!liveSite) {
      renderProfile();
      document.documentElement.classList.remove('pw-portal-booting');
      return;
    }

    try {
      applyVerifiedProfile(
        await getRecord('/api/me')
      );

      renderProfile();
      // Restore the admin deep-link after the verified profile loads.
      if (location.hash === '#admin' && user.isAdmin) {
        showPanel('admin', false);
      }
      await loadLeadershipRecord();
    } catch (error) {
      console.warn(
        'Member profile unavailable:',
        error.message
      );

      renderProfile();

      setText(
        'onboardingFootNote',
        'Unable to verify your team profile right now. Nothing was changed.'
      );
    } finally {
      // pw-portal-boot-ready-20261018: never show the placeholder training
      // dashboard before member and learning status have been reconciled.
      document.documentElement.classList.remove('pw-portal-booting');
      const loader = document.getElementById('pwPortalLoading');
      if (loader) loader.hidden = true;
    }
  }

  /*
   * ==========================================================
   * OUR PEOPLE & TEAM DIRECTORY
   * ==========================================================
   */

  let directoryLoaded = false;
  let directory = [];
  let visibleDirectory = [];

  function normalizeDirectory(result) {
    if (Array.isArray(result)) {
      return result;
    }

    if (Array.isArray(result?.members)) {
      return result.members;
    }

    if (Array.isArray(result?.departments)) {
      return result.departments.flatMap(dept =>
        (
          Array.isArray(dept.members)
            ? dept.members
            : []
        ).map(person =>
          typeof person === 'string'
            ? {
                name: person,
                department: dept.name || dept.department
              }
            : {
                ...person,
                department:
                  person.department ||
                  dept.name ||
                  dept.department
              }
        )
      );
    }

    return [];
  }

  function renderDirectory() {
    const host = $('teamDirectoryGrid');
    if (!host) return;

    const q = String(
      $('directorySearch')?.value || ''
    ).trim().toLowerCase();

    host.replaceChildren();

    visibleDirectory = directory.filter(p =>
      [p.name, p.role, p.department]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );

    visibleDirectory.forEach((person, index) => {
      const button = document.createElement('button');

      button.type = 'button';
      button.className = 'pw-directory-person';

      const name = document.createElement('strong');
      name.textContent = person.name || 'Team Member';

      const detail = document.createElement('small');

      detail.textContent =
        ' — ' +
        (person.role || 'Team Member') +
        ' · ' +
        (person.department || 'Department not assigned');

      button.append(name, detail);

      button.addEventListener('click', () => {
        openDirectoryProfile(index);
      });

      host.append(button);
    });

    setText(
      'directoryStatus',
      visibleDirectory.length
        ? 'Showing ' + visibleDirectory.length + ' team member(s).'
        : 'No matching team members are available.'
    );
  }

  async function loadDirectory() {
    if (directoryLoaded) {
      return renderDirectory();
    }

    if (!liveSite || !signedIn) {
      setText(
        'directoryStatus',
        'Sign in on Project Worth to view the team directory.'
      );

      return;
    }

    setText('directoryStatus', 'Loading team directory…');

    try {
      directory = normalizeDirectory(
        await getRecord('/api/team-directory')
      );

      directoryLoaded = true;
      renderDirectory();
    } catch (error) {
      console.warn(
        'Team directory unavailable:',
        error.message
      );

      setText(
        'directoryStatus',
        'Directory temporarily unavailable. No data was changed.'
      );
    }
  }

  function openDirectoryProfile(index) {
    const person = visibleDirectory[index];

    if (!person || !$('directoryProfileModal')) return;

    setText(
      'directoryProfileName',
      person.name || 'Team Member'
    );

    setText(
      'directoryProfileRole',
      person.role || 'Team Member'
    );

    setText(
      'directoryProfileDepartment',
      person.department || 'To be assigned'
    );

    setText(
      'directoryProfileInfo',
      person.about || 'No additional information shared.'
    );

    if ($('directoryOwnProfileLink')) {
      $('directoryOwnProfileLink').hidden =
        String(person.name || '').toLowerCase() !==
        user.name.toLowerCase();
    }

    show('directoryProfileModal', true);

    $('closeDirectoryProfile')?.focus();
  }

  function closeDirectoryProfile() {
    show('directoryProfileModal', false);
  }

  function installDirectoryControls() {
    $('directorySearch')?.addEventListener(
      'input',
      renderDirectory
    );

    $('directoryShowAllButton')?.addEventListener('click', () => {
      if ($('directorySearch')) {
        $('directorySearch').value = '';
      }

      renderDirectory();
    });

    $('directoryMyTeamButton')?.addEventListener('click', () => {
      if ($('directorySearch')) {
        $('directorySearch').value = user.department;
      }

      renderDirectory();
    });

    $('closeDirectoryProfile')?.addEventListener(
      'click',
      closeDirectoryProfile
    );

    $('directoryProfileModal')?.addEventListener('click', event => {
      if (event.target === $('directoryProfileModal')) {
        closeDirectoryProfile();
      }
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeDirectoryProfile();
      }
    });
  }

  /*
   * ==========================================================
   * LEARNING MODAL
   * ==========================================================
   */

  function installModalControls() {
    const close = () => {
      show('learningItemModal', false);
    };

    $('closeLearningModal')?.addEventListener('click', close);

    $('learningModalCloseButton')?.addEventListener(
      'click',
      close
    );

    $('learningModalAddButton')?.addEventListener('click', () => {
      navigate(PATHS.learning);
    });

    $('learningModalCompleteButton')?.addEventListener('click', () => {
      setText(
        'learningModalBody',
        'Training completion is recorded by the authorized learning service, not this button.'
      );
    });

    $('learningItemModal')?.addEventListener('click', event => {
      if (event.target === $('learningItemModal')) {
        close();
      }
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        close();
      }
    });
  }

  /*
   * ==========================================================
   * ADMIN SAFETY
   * ==========================================================
   */

  function installAdminSafety() {
    // Do not imitate a working admin backend
    // or disclose confidential incident information.
    const disable = [
      'adminCreateMember',
      'adminIncidentUpdate'
    ];

    disable.forEach(id => {
      if ($(id)) {
        $(id).disabled = true;
      }
    });

    setText(
      'adminCreationStatus',
      'Secure account creation is not connected. No account will be created.'
    );

    setText(
      'adminMembersStatus',
      'Account management needs an authorized admin API.'
    );

    setText(
      'adminIncidentStatus',
      'Confidential report access requires the secured report API.'
    );

    $('adminMemberForm')?.addEventListener('submit', event => {
      event.preventDefault();

      setText(
        'adminCreationStatus',
        'No account created. Admin API not connected.'
      );
    });

    $('adminRefreshUsers')?.addEventListener('click', () => {
      setText(
        'adminMembersStatus',
        'No records loaded. Admin API not connected.'
      );
    });

    $('adminRefreshReports')?.addEventListener('click', () => {
      setText(
        'adminIncidentStatus',
        'No reports loaded. Secure report API not connected.'
      );
    });

    $('adminIncidentUpdate')?.addEventListener('click', () => {
      setText(
        'adminIncidentSaveStatus',
        'No report changed. Secure API not connected.'
      );
    });
  }

  /*
   * ==========================================================
   * INITIALIZE PORTAL
   * ==========================================================
   */

  function init() {
    if (liveSite && !signedIn) {
      navigate(PATHS.login, true);
      return;
    }

    installNavigation();
    installDirectoryControls();
    installModalControls();
    installAdminSafety();

    renderProfile();
    loadProfile();

    // Refresh profile information when returning
    // from My Profile or restoring the page.
    window.addEventListener('pageshow', () => {
      renderProfile();

      if (liveSite && signedIn) {
        loadProfile();
      }
    });

    window.addEventListener('focus', renderProfile);

    window.addEventListener('storage', event => {
      if (event.key === optionalProfileKey) {
        renderProfile();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      init,
      { once: true }
    );
  } else {
    init();
  }
})();
