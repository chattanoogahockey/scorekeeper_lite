const DEFAULT_OWNER = 'chattanoogaHockey';
const DEFAULT_REPO = 'scorekeeper_lite';
const SETTINGS_KEY = 'scorekeeper:adminSettings';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function readStoredSettings() {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (error) {
    console.warn('Failed to read admin settings', error);
    return {};
  }
}

function persistSettings({ owner, repo, rememberToken, token }) {
  try {
    const payload = {
      owner,
      repo,
      rememberToken: Boolean(rememberToken),
    };

    if (payload.rememberToken && token) {
      payload.token = token;
    }

    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Failed to persist admin settings', error);
  }
}

function clearStoredSettings() {
  try {
    window.localStorage.removeItem(SETTINGS_KEY);
  } catch (error) {
    console.warn('Failed to clear admin settings', error);
  }
}

function getPrefill() {
  const stored = readStoredSettings();
  return {
    owner: stored.owner || DEFAULT_OWNER,
    repo: stored.repo || DEFAULT_REPO,
    token: stored.token || '',
    rememberToken: Boolean(stored.rememberToken && stored.token),
  };
}

function formatDateLabel(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.valueOf())) {
    return 'Unknown date';
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.valueOf())) {
    return 'Unknown';
  }

  return date.toLocaleString();
}

function asNumber(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildTopDayLabel(bestDay) {
  if (!bestDay) {
    return 'No traffic data yet';
  }

  const date = formatDateLabel(bestDay.timestamp);
  return `${date} — ${bestDay.count} views / ${bestDay.uniques} unique`;
}

export const adminDashboardView = {
  id: 'admin-dashboard',
  hideHeader: false,
  template() {
    const prefill = getPrefill();
    const owner = escapeHtml(prefill.owner);
    const repo = escapeHtml(prefill.repo);
    const token = escapeHtml(prefill.token);
    const rememberChecked = prefill.rememberToken ? 'checked' : '';

    return `
      <section class="admin-panel">
        <h1>Admin Dashboard</h1>
        <div class="card">
          <h2>GitHub Traffic</h2>
          <p class="admin-panel__subtitle">
            Provide GitHub details to review page view analytics for this site.
          </p>
          <form data-role="traffic-form" class="admin-form">
            <div class="form-grid">
              <div class="form-group">
                <label for="admin-owner">Repository Owner</label>
                <input id="admin-owner" data-field="owner" type="text" value="${owner}" autocomplete="off" required />
              </div>
              <div class="form-group">
                <label for="admin-repo">Repository Name</label>
                <input id="admin-repo" data-field="repo" type="text" value="${repo}" autocomplete="off" required />
              </div>
              <div class="form-group">
                <label for="admin-token">GitHub Personal Access Token</label>
                <input id="admin-token" data-field="token" type="password" value="${token}" autocomplete="off" required />
                <p class="form-hint">
                  PAT needs <code>repo</code> or <code>public_repo</code> scope to access traffic metrics.
                </p>
              </div>
              <div class="form-group form-group--checkbox">
                <label>
                  <input type="checkbox" data-field="remember-token" ${rememberChecked} /> Remember token on this device
                </label>
                <p class="form-hint">Token stays in local storage when remembered.</p>
              </div>
            </div>
            <div class="form-actions">
              <button class="btn" type="submit" data-role="fetch">Load Metrics</button>
              <button class="btn btn-secondary" type="button" data-action="clear">Clear Stored Credentials</button>
            </div>
          </form>
          <div class="admin-feedback" data-role="feedback" hidden></div>
        </div>
        <div class="card" data-role="metrics-card" hidden>
          <h2>Traffic Overview</h2>
          <div class="kpi-grid">
            <div class="kpi-card">
              <span class="kpi-label">Total Views</span>
              <span class="kpi-value" data-role="metric-total">—</span>
              <span class="kpi-context">Last 14 days</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-label">Unique Visitors</span>
              <span class="kpi-value" data-role="metric-unique">—</span>
              <span class="kpi-context">Distinct people</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-label">7-Day Views</span>
              <span class="kpi-value" data-role="metric-seven-day">—</span>
              <span class="kpi-context">Rolling total</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-label">Average / Day</span>
              <span class="kpi-value" data-role="metric-average">—</span>
              <span class="kpi-context">Across reporting period</span>
            </div>
          </div>
          <div class="kpi-meta">
            <p><strong>Top Day:</strong> <span data-role="metric-top-day">—</span></p>
            <p><strong>Last Updated:</strong> <span data-role="metric-updated">—</span></p>
            <p data-role="metric-rate" hidden></p>
          </div>
        </div>
        <div class="card" data-role="daily-card" hidden>
          <h2>Daily Breakdown</h2>
          <div class="table-wrapper">
            <table class="traffic-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Views</th>
                  <th scope="col">Unique Visitors</th>
                </tr>
              </thead>
              <tbody data-role="daily-table"></tbody>
            </table>
          </div>
        </div>
      </section>
    `;
  },
  navigation() {
    return '<button class="nav-btn" data-action="back-to-menu">Back to Menu</button>';
  },
  bind(app) {
    const main = app.mainContent;
    const nav = app.topNavigation;
    const backButton = nav.querySelector('[data-action="back-to-menu"]');
    backButton?.addEventListener('click', () => app.showStartupMenu());

    const form = main.querySelector('[data-role="traffic-form"]');
    const fetchButton = form?.querySelector('[data-role="fetch"]');
    const ownerInput = form?.querySelector('[data-field="owner"]');
    const repoInput = form?.querySelector('[data-field="repo"]');
    const tokenInput = form?.querySelector('[data-field="token"]');
    const rememberCheckbox = form?.querySelector('[data-field="remember-token"]');
    const clearButton = form?.querySelector('[data-action="clear"]');
    const feedback = main.querySelector('[data-role="feedback"]');
    const metricsCard = main.querySelector('[data-role="metrics-card"]');
    const dailyCard = main.querySelector('[data-role="daily-card"]');
    const dailyTable = main.querySelector('[data-role="daily-table"]');
    const totalMetric = main.querySelector('[data-role="metric-total"]');
    const uniqueMetric = main.querySelector('[data-role="metric-unique"]');
    const sevenDayMetric = main.querySelector('[data-role="metric-seven-day"]');
    const averageMetric = main.querySelector('[data-role="metric-average"]');
    const topDayMetric = main.querySelector('[data-role="metric-top-day"]');
    const updatedMetric = main.querySelector('[data-role="metric-updated"]');
    const rateMetric = main.querySelector('[data-role="metric-rate"]');

    const numberFormatter = new Intl.NumberFormat();
    const averageFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 });

    const setFeedback = (message, tone = 'info') => {
      if (!feedback) return;
      feedback.textContent = message;
      feedback.dataset.tone = tone;
      feedback.hidden = !message;
    };

    const toggleLoading = (isLoading) => {
      if (!fetchButton) return;
      fetchButton.disabled = isLoading;
      fetchButton.textContent = isLoading ? 'Loading…' : 'Load Metrics';
    };

    const resetMetrics = () => {
      if (metricsCard) metricsCard.hidden = true;
      if (dailyCard) dailyCard.hidden = true;
      if (dailyTable) dailyTable.innerHTML = '';
      if (rateMetric) {
        rateMetric.hidden = true;
        rateMetric.textContent = '';
      }
    };

    if (rememberCheckbox) {
      rememberCheckbox.addEventListener('change', () => {
        if (!rememberCheckbox.checked) {
          persistSettings({
            owner: ownerInput?.value.trim() || DEFAULT_OWNER,
            repo: repoInput?.value.trim() || DEFAULT_REPO,
            rememberToken: false,
            token: '',
          });
        }
      });
    }

    clearButton?.addEventListener('click', () => {
      clearStoredSettings();
      if (ownerInput) ownerInput.value = DEFAULT_OWNER;
      if (repoInput) repoInput.value = DEFAULT_REPO;
      if (tokenInput) tokenInput.value = '';
      if (rememberCheckbox) rememberCheckbox.checked = false;
      resetMetrics();
      setFeedback('Stored credentials cleared.', 'success');
    });

    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!ownerInput || !repoInput || !tokenInput) {
        return;
      }

      const owner = ownerInput.value.trim();
      const repo = repoInput.value.trim();
      const token = tokenInput.value.trim();
      const rememberToken = Boolean(rememberCheckbox?.checked);

      if (!owner || !repo || !token) {
        setFeedback('Owner, repository, and token are required.', 'error');
        resetMetrics();
        return;
      }

      toggleLoading(true);
      setFeedback('Fetching GitHub traffic…', 'info');

      try {
        const url = `https://api.github.com/repos/${owner}/${repo}/traffic/views`;
        const response = await fetch(url, {
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
          },
        });

        const text = await response.text();
        const payload = text ? JSON.parse(text) : {};

        if (response.status === 401) {
          setFeedback('Unauthorized. Check that your token is correct and has the required scope.', 'error');
          resetMetrics();
          return;
        }

        if (response.status === 404) {
          setFeedback('Repository not found. Verify the owner and repo values.', 'error');
          resetMetrics();
          return;
        }

        if (response.status === 202) {
          setFeedback('Traffic data is being generated. Please try again in a few moments.', 'warning');
          resetMetrics();
          return;
        }

        if (!response.ok) {
          const message = payload?.message || 'Unable to load traffic data.';
          setFeedback(message, 'error');
          resetMetrics();
          return;
        }

        persistSettings({ owner, repo, rememberToken, token });

        const { count = 0, uniques = 0, views = [] } = payload;
        const totalViews = numberFormatter.format(count);
        const uniqueViews = numberFormatter.format(uniques);
        const sevenDayViewsRaw = views.slice(-7).reduce((sum, item) => sum + (item?.count || 0), 0);
        const sevenDayViews = numberFormatter.format(sevenDayViewsRaw);
        const average = views.length ? count / views.length : 0;
        const averageDisplay = views.length ? averageFormatter.format(average) : '0.0';
        const bestDay = views.reduce((currentBest, entry) => {
          if (!entry) return currentBest;
          if (!currentBest) return entry;
          if (entry.count > currentBest.count) return entry;
          if (entry.count === currentBest.count && entry.uniques > currentBest.uniques) return entry;
          return currentBest;
        }, null);
        const lastEntry = views.length ? views[views.length - 1] : null;
        const lastUpdated = lastEntry ? formatDateTime(lastEntry.timestamp) : formatDateTime(Date.now());

        if (totalMetric) totalMetric.textContent = totalViews;
        if (uniqueMetric) uniqueMetric.textContent = uniqueViews;
        if (sevenDayMetric) sevenDayMetric.textContent = sevenDayViews;
        if (averageMetric) averageMetric.textContent = averageDisplay;
        if (topDayMetric) topDayMetric.textContent = buildTopDayLabel(bestDay);
        if (updatedMetric) updatedMetric.textContent = lastUpdated;

        if (rateMetric) {
          const limit = asNumber(response.headers.get('x-ratelimit-limit'));
          const remaining = asNumber(response.headers.get('x-ratelimit-remaining'));
          const reset = asNumber(response.headers.get('x-ratelimit-reset'));

          if (limit !== null && remaining !== null) {
            const resetLabel = reset ? formatDateTime(reset * 1000) : 'unknown';
            rateMetric.textContent = `Rate limit: ${remaining}/${limit} remaining (resets ${resetLabel})`;
            rateMetric.hidden = false;
          } else {
            rateMetric.hidden = true;
            rateMetric.textContent = '';
          }
        }

        if (dailyTable) {
          dailyTable.innerHTML = views
            .map((entry) => {
              const dateLabel = formatDateLabel(entry.timestamp);
              const viewCount = numberFormatter.format(entry.count || 0);
              const uniqueCount = numberFormatter.format(entry.uniques || 0);
              return `<tr><td>${dateLabel}</td><td>${viewCount}</td><td>${uniqueCount}</td></tr>`;
            })
            .join('');
        }

        if (metricsCard) metricsCard.hidden = false;
        if (dailyCard) dailyCard.hidden = views.length === 0;

        setFeedback('Traffic data loaded successfully.', 'success');
      } catch (error) {
        console.error('Failed to load GitHub traffic', error);
        setFeedback('Something went wrong while contacting GitHub.', 'error');
        resetMetrics();
      } finally {
        toggleLoading(false);
      }
    });
  },
};
