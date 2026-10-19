
/*
 * PROJECT WORTH
 * TRAINING & RESEARCH INSTITUTE
 *
 * Learning Center Shared JavaScript
 *
 * Supports:
 * - My Learning
 * - Department Training
 * - My Certificates
 * - Team Lead Learning
 * - Project Worth Orientation
 * - Light the Way Commitment
 *
 * Current Orientation:
 * 52 slides
 * 5 knowledge checks
 * 20-question final assessment
 * Electronic signature
 * Practice completion certificate
 *
 * IMPORTANT:
 * Practice progress is stored separately for each
 * signed-in member in this browser.
 *
 * Official completion records, signatures, and
 * certificates still require a secure AWS backend.
 */

(function () {
  'use strict';

  // ============================================
  // CONFIGURATION
  // ============================================

  const PROFILE_API_URL =
    'https://t0pckriwia.execute-api.us-east-2.amazonaws.com/api/me';

  const TOTAL_SLIDES = 52;

  const ORIENTATION_PAGE =
    'light-the-way-foundations.html';

  const LOGIN_PAGE =
    'institute-login.html';

  const isLocalPreview =
    window.location.protocol === 'file:';

  const idToken =
    sessionStorage.getItem('pwInstituteIdToken');

  const expiry = Number(
    sessionStorage.getItem('pwInstituteExpiresAt') || 0
  );

  const sessionIsValid = Boolean(
    idToken &&
    expiry > Date.now() + 10000
  );

  // Require a valid login outside local previews.

  if (!isLocalPreview && !sessionIsValid) {
    window.location.replace(LOGIN_PAGE);
    return;
  }

  // ============================================
  // HELPERS
  // ============================================

  function readJson(key, fallback) {
    try {
      const value = localStorage.getItem(key);

      return value
        ? JSON.parse(value)
        : fallback;

    } catch (error) {
      return fallback;
    }
  }

  function parseClaims(token) {
    if (!token) return {};

    try {
      const encoded = token
        .split('.')[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/');

      const payload = atob(encoded);

      return JSON.parse(
        decodeURIComponent(
          Array.from(payload, char =>
            '%' +
            char.charCodeAt(0)
              .toString(16)
              .padStart(2, '0')
          ).join('')
        )
      );

    } catch (error) {
      return {};
    }
  }

  function clearSession() {
    [
      'pwInstituteAccessToken',
      'pwInstituteIdToken',
      'pwInstituteRefreshToken',
      'pwInstituteExpiresAt'
    ].forEach(key => {
      sessionStorage.removeItem(key);
    });
  }

  function formatDate(value) {
    if (!value) return 'Date unavailable';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return 'Date unavailable';
    }

    return date.toLocaleDateString(
      'en-US',
      {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }
    );
  }

  // ============================================
  // LOGOUT
  // ============================================

  document.querySelectorAll('[data-logout]')
    .forEach(button => {

      button.addEventListener('click', () => {
        clearSession();

        window.location.assign(LOGIN_PAGE);
      });

    });

  // ============================================
  // SIGNED-IN ACCOUNT
  // ============================================

  const claims = sessionIsValid
    ? parseClaims(idToken)
    : {};

  const userKey =
    claims.sub ||
    claims['cognito:username'] ||
    'local-preview';

  /*
   * IMPORTANT:
   * This must match the storage key inside
   * light-the-way-foundations.html.
   *
   * Each Cognito account has its own progress.
   */

  const ORIENTATION_STORAGE_KEY =
    'pwFoundations:orientation-v3:' + userKey;

  // ============================================
  // PROFILE
  // ============================================

  const developmentProfile = isLocalPreview
    ? readJson('pwPortalShellPreviewProfile', {})
    : {};

  const previewLead =
    isLocalPreview &&
    new URLSearchParams(
      window.location.search
    ).get('preview') === 'lead';

  const profile = {

    name:
      claims.name ||
      developmentProfile.name ||
      'Project Worth Team Member',

    department:
      developmentProfile.department ||
      'Department not assigned',

    role:
      developmentProfile.role ||
      'Team Member',

    isTeamLead: Boolean(
      developmentProfile.isTeamLead ||
      previewLead
    ),

    foundations: null,

    orientation: null,

    learningRecords: null

  };

  /*
   * Hide the placeholder name while AWS
   * retrieves the correct member profile.
   */

  if (!isLocalPreview) {

    document.querySelectorAll('[data-name]')
      .forEach(element => {
        element.style.visibility = 'hidden';
      });

  }

  // ============================================
  // ORIENTATION PROGRESS
  // ============================================

  function getOrientationState() {

    const saved = readJson(
      ORIENTATION_STORAGE_KEY,
      {}
    );

    if (
      !saved ||
      typeof saved !== 'object' ||
      Array.isArray(saved)
    ) {
      return {};
    }

    return saved;
  }

  function normalizeSlideCount(value) {

    const number = Number(value);

    if (!Number.isFinite(number)) {
      return 0;
    }

    return Math.max(
      0,
      Math.min(
        TOTAL_SLIDES,
        Math.floor(number)
      )
    );
  }

  function progressInfo() {

    const state = getOrientationState();

    // Slides

    const slidesComplete =
      state.done === true;

    const completedSlides = slidesComplete
      ? TOTAL_SLIDES
      : normalizeSlideCount(state.index);

    // Course started

    const started = Boolean(
      completedSlides > 0 ||
      slidesComplete ||
      state.passed === true ||
      state.agreed === true ||
      Number(state.tries) > 0 ||
      (
        Array.isArray(state.checks) &&
        state.checks.length > 0
      )
    );

    // Final assessment

    const assessmentPassed =
      state.passed === true;

    const assessmentAttempts = Math.max(
      0,
      Number(state.tries) || 0
    );

    // Electronic signature

    const commitmentSigned = Boolean(
      state.agreed === true &&
      typeof state.signedName === 'string' &&
      state.signedName.trim() &&
      state.signedAt
    );

    // Browser practice completion

    const practiceComplete = Boolean(
      slidesComplete &&
      assessmentPassed &&
      commitmentSigned
    );

    // Score

    const correctAnswers = Number(
      state.lastCorrect
    );

    const score = (
      assessmentAttempts > 0 &&
      Number.isFinite(correctAnswers) &&
      correctAnswers >= 0 &&
      correctAnswers <= 20
    )
      ? correctAnswers * 5
      : null;

    /*
     * OFFICIAL AWS VERIFICATION
     *
     * Do not use the old foundations
     * modulesCompleted/assessmentPassed fields
     * as proof of this orientation's completion.
     *
     * The backend will eventually supply a
     * verified orientation record.
     */

    const serverRecord =
      profile.orientation ||
      (
        profile.learningRecords &&
        profile.learningRecords.orientation
      ) ||
      {};

    const officialComplete = Boolean(
      serverRecord.verified === true &&
      serverRecord.assessmentPassed === true &&
      serverRecord.agreementSigned === true
    );

    // Current training status

    let status = 'Not started';

    if (started) {
      status = 'In progress';
    }

    if (slidesComplete) {
      status = 'Assessment pending';
    }

    if (assessmentPassed) {
      status = 'Commitment pending';
    }

    if (practiceComplete) {
      status = 'Practice complete';
    }

    if (officialComplete) {
      status = 'Verified complete';
    }

    return {

      // Compatibility with existing page scripts
      completed: completedSlides,
      practicePassed: assessmentPassed,
      official: officialComplete,
      score: score,
      passedAt: state.signedAt || '',

      // Current orientation
      totalSlides: TOTAL_SLIDES,
      completedSlides: completedSlides,
      slidesComplete: slidesComplete,
      started: started,

      // Assessment
      assessmentPassed: assessmentPassed,
      assessmentAttempts: assessmentAttempts,

      // Agreement
      commitmentSigned: commitmentSigned,
      signedName: state.signedName || '',
      signedAt: state.signedAt || '',
      agreementDate: state.agreementDate || '',
      agreementVersion: state.agreementVersion || '',

      // Overall completion
      practiceComplete: practiceComplete,
      officialComplete: officialComplete,

      status: status,

      summaryText:
        completedSlides +
        ' of ' +
        TOTAL_SLIDES +
        ' slides completed'

    };
  }

  // ============================================
  // MY LEARNING DASHBOARD
  // ============================================

  function updateFoundationOverview(progress) {

    const bar = document.querySelector(
      '[data-foundations-fill]'
    );

    const count = document.querySelector(
      '[data-foundations-count]'
    );

    const status = document.querySelector(
      '[data-foundations-status]'
    );

    const action = document.querySelector(
      '[data-course-link]'
    );

    const meter = document.querySelector(
      '.pw-meter'
    );

    const percentage =
      progress.completedSlides /
      TOTAL_SLIDES * 100;

    // Progress bar

    if (bar) {
      bar.style.width = percentage + '%';
    }

    if (meter) {

      meter.setAttribute(
        'role',
        'progressbar'
      );

      meter.setAttribute(
        'aria-label',
        'Orientation slide progress'
      );

      meter.setAttribute(
        'aria-valuemin',
        '0'
      );

      meter.setAttribute(
        'aria-valuemax',
        String(TOTAL_SLIDES)
      );

      meter.setAttribute(
        'aria-valuenow',
        String(progress.completedSlides)
      );

    }

    // Progress count

    if (count) {
      if (
        count.textContent !==
        progress.summaryText
      ) {
        count.textContent =
          progress.summaryText;
      }
    }

    // Status badge

    if (status) {
      status.textContent = progress.status;
    }

    // Course button

    if (action) {

      action.href = ORIENTATION_PAGE;

      if (progress.officialComplete) {

        action.textContent =
          'Review Completed Orientation →';

      } else if (progress.practiceComplete) {

        action.textContent =
          'View Your Certificate →';

      } else if (progress.assessmentPassed) {

        action.textContent =
          'Sign Your Commitment →';

      } else if (progress.started) {

        action.textContent =
          'Continue Orientation →';

      } else {

        action.textContent =
          'Start Orientation →';

      }

    }

    // Update old seven-module description.

    const description = document.querySelector(
      '.pw-primary-card > p'
    );

    if (description) {

      description.textContent =
        'Explore 52 orientation slides, complete ' +
        'knowledge checks, pass the final assessment, ' +
        'and sign your Light the Way Commitment.';

    }

    // Display truthful record status.

    const recordNotice =
      document.getElementById(
        'learningRecordNotice'
      );

    if (recordNotice) {

      recordNotice.textContent =
        progress.officialComplete
          ? 'Your orientation completion has been verified in your Project Worth member record.'
          : 'Your orientation progress is currently saved in this browser for your account. Secure AWS completion recording is not connected yet.';

    }
  }

  // ============================================
  // DEPARTMENT TRAINING
  // ============================================

  function updateDepartmentAccess(progress) {

    const notice =
      document.getElementById(
        'departmentAccess'
      );

    if (!notice) return;

    if (progress.officialComplete) {

      notice.textContent =
        'Your Light the Way Orientation has been ' +
        'officially verified. Continue with any ' +
        'department training assigned to your role.';

    } else if (progress.practiceComplete) {

      notice.textContent =
        'You completed the orientation assessment ' +
        'and signed your Light the Way Commitment. ' +
        'Official completion recording is still pending.';

    } else if (progress.assessmentPassed) {

      notice.textContent =
        'You passed your orientation assessment. ' +
        'Your next step is signing the Light the Way Commitment.';

    } else if (progress.slidesComplete) {

      notice.textContent =
        'Your orientation slides are complete. ' +
        'Take the final assessment to continue.';

    } else {

      notice.textContent =
        'Begin with Project Worth Orientation. ' +
        'Additional department learning follows ' +
        'your required training.';

    }
  }

  // ============================================
  // MY CERTIFICATES
  // ============================================

  function updateCertificatePage(progress) {

    const card =
      document.getElementById(
        'localRecord'
      );

    const details =
      document.getElementById(
        'recordDetails'
      );

    if (!card) return;

    // Hide the record until an assessment
    // is passed or official verification exists.

    if (
      !progress.assessmentPassed &&
      !progress.officialComplete
    ) {

      card.hidden = true;
      return;

    }

    card.hidden = false;

    if (!details) return;

    if (progress.officialComplete) {

      details.textContent =
        'Project Worth Orientation · ' +
        'Officially verified completion.';

      return;
    }

    const scoreLabel =
      progress.score === null
        ? 'Score unavailable'
        : progress.score + '% assessment score';

    if (progress.practiceComplete) {

      details.textContent =
        'Project Worth Orientation · ' +
        scoreLabel +
        ' · Light the Way Commitment signed ' +
        formatDate(progress.signedAt) +
        '. Practice certificate available in the course. ' +
        'Official verification is not yet connected.';

    } else {

      details.textContent =
        'Project Worth Orientation · ' +
        scoreLabel +
        ' · Assessment passed. ' +
        'Light the Way Commitment signature pending.';

    }
  }

  // ============================================
  // PROFILE WARNINGS
  // ============================================

  function showProfileWarning(message) {

    const notice =
      document.getElementById(
        'profileNotice'
      );

    if (notice) {
      notice.hidden = false;
      notice.textContent = message;
    }
  }

  // ============================================
  // DISPLAY MEMBER PROFILE
  // ============================================

  function render() {

    // Name

    document.querySelectorAll('[data-name]')
      .forEach(element => {

        element.textContent = profile.name;

        element.style.visibility =
          'visible';

      });

    // Department

    document.querySelectorAll('[data-department]')
      .forEach(element => {

        element.textContent =
          profile.department;

      });

    // Department Lead features

    document.querySelectorAll('[data-lead-tab]')
      .forEach(element => {

        element.hidden =
          !profile.isTeamLead;

      });

    document.querySelectorAll('[data-lead-only]')
      .forEach(element => {

        element.hidden =
          !profile.isTeamLead;

      });

    document.querySelectorAll('[data-not-lead]')
      .forEach(element => {

        element.hidden =
          profile.isTeamLead;

      });

    // Hide Team Lead learning tab
    // from non-lead members.

    document.querySelectorAll(
      'a[href="team-lead-learning.html"]'
    ).forEach(element => {

      element.hidden =
        !profile.isTeamLead;

      element.style.display =
        profile.isTeamLead
          ? ''
          : 'none';

    });

    // Training progress

    const progress = progressInfo();

    updateFoundationOverview(progress);

    updateDepartmentAccess(progress);

    updateCertificatePage(progress);

    // Maintain compatibility with any
    // page-specific Learning Center code.

    if (
      typeof window.renderLearningPage === 'function'
    ) {

      window.renderLearningPage(
        profile,
        progress,
        readJson,
        userKey
      );

    }
  }

  // ============================================
  // LOAD MEMBER PROFILE FROM AWS
  // ============================================

  async function loadProfile() {

    if (isLocalPreview) {
      render();
      return;
    }

    try {

      const response = await fetch(
        PROFILE_API_URL,
        {
          method: 'GET',

          headers: {
            Authorization:
              'Bearer ' + idToken,

            Accept:
              'application/json'
          }
        }
      );

      // Expired or unauthorized session

      if (
        response.status === 401 ||
        response.status === 403
      ) {

        clearSession();

        window.location.replace(
          LOGIN_PAGE
        );

        return;
      }

      if (!response.ok) {

        throw new Error(
          'Unable to verify Project Worth profile.'
        );

      }

      const serverProfile =
        await response.json();

      // Update display name

      profile.name =
        serverProfile.name ||
        profile.name;

      // Update department

      profile.department =
        serverProfile.department ||
        'Department not assigned';

      // Update role

      profile.role =
        serverProfile.role ||
        'Team Member';

      // Permissions

      const permissions =
        Array.isArray(
          serverProfile.permissions
        )
          ? serverProfile.permissions
          : [];

      const leadName =
        serverProfile.departmentTeamLead ||
        serverProfile.teamLead ||
        '';

      profile.isTeamLead =
        typeof serverProfile.isTeamLead === 'boolean'

          ? serverProfile.isTeamLead

          : (
              permissions.includes(
                'DEPARTMENT_LEAD'
              ) ||

              Boolean(
                serverProfile.name &&
                leadName &&
                serverProfile.name.trim()
                  .toLowerCase() ===
                String(leadName).trim()
                  .toLowerCase()
              )
            );

      // Existing Foundations fields
      // remain available for compatibility.

      profile.foundations =
        serverProfile.foundations ||
        null;

      // Future AWS orientation record

      profile.orientation =
        serverProfile.orientation ||
        null;

      profile.learningRecords =
        serverProfile.learningRecords ||
        null;

      render();

    } catch (error) {

      profile.isTeamLead = false;

      showProfileWarning(
        'We could not verify your Project Worth ' +
        'profile. Please refresh or sign in again. ' +
        'Team Lead features remain unavailable ' +
        'until your profile is verified.'
      );

      render();

    }
  }

  // ============================================
  // FIX OLD MY LEARNING INLINE PROGRESS
  // ============================================

  /*
   * Some versions of my-learning.html
   * still contain a separate script that writes:
   *
   * "0 of 7 modules"
   *
   * This observer corrects that old display
   * without requiring an additional HTML change.
   *
   * When my-learning.html is fully updated,
   * this compatibility section can be removed.
   */

  const countElement =
    document.querySelector(
      '[data-foundations-count]'
    );

  if (
    countElement &&
    typeof MutationObserver !== 'undefined'
  ) {

    const observer =
      new MutationObserver(() => {

        const progress = progressInfo();

        if (
          countElement.textContent !==
          progress.summaryText
        ) {

          updateFoundationOverview(
            progress
          );

        }

      });

    observer.observe(
      countElement,
      {
        childList: true,
        characterData: true,
        subtree: true
      }
    );
  }

  // ============================================
  // REFRESH PROGRESS WHEN RETURNING
  // ============================================

  /*
   * When someone completes orientation
   * and returns to My Learning, refresh the
   * local progress display.
   */

  window.addEventListener(
    'pageshow',
    () => {
      render();
    }
  );

  window.addEventListener(
    'focus',
    () => {
      render();
    }
  );

  /*
   * Update if progress changes in another
   * browser tab for the same signed-in account.
   */

  window.addEventListener(
    'storage',
    event => {

      if (
        event.key ===
        ORIENTATION_STORAGE_KEY
      ) {

        render();

      }

    }
  );

  // ============================================
  // INITIALIZE
  // ============================================

  loadProfile();

})();
