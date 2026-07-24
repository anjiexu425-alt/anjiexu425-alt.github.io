import {
  buildItemSubmission,
  emptyStateHTML,
  projectCardHTML,
  skillRowHTML,
  supabaseRowToItem,
} from './toolkit-model.mjs';
import {
  deleteToolkitProject,
  deleteToolkitSkill,
  fetchToolkitProjects,
  fetchToolkitSkills,
  insertToolkitProject,
  insertToolkitSkill,
} from './toolkit-supabase.js';
import {
  getSession,
  onAuthStateChange,
  signIn,
  signOut,
} from './diary-supabase.js';

let isLoggedIn = false;
let skills = [];
let projects = [];
let skillTags = [];
let projectTags = [];

const skillsList = document.getElementById('toolkitSkillsList');
const projectsGrid = document.getElementById('toolkitProjectsGrid');
const statusEl = document.getElementById('toolkitStatus');

const loginButton = document.getElementById('toolkitLoginButton');
const logoutButton = document.getElementById('toolkitLogoutButton');
const addSkillButton = document.getElementById('toolkitAddSkillButton');
const addProjectButton = document.getElementById('toolkitAddProjectButton');

const skillDialogBackdrop = document.getElementById('toolkitSkillDialogBackdrop');
const skillForm = document.getElementById('toolkitSkillForm');
const skillNameInput = document.getElementById('toolkitSkillName');
const skillUrlInput = document.getElementById('toolkitSkillUrl');
const skillDescInput = document.getElementById('toolkitSkillDesc');
const skillTagsInput = document.getElementById('toolkitSkillTagsInput');
const skillTagField = document.getElementById('toolkitSkillTagField');
const skillErrorEl = document.getElementById('toolkitSkillError');
const skillCancelButton = document.getElementById('toolkitSkillCancel');
const skillDialogCloseButton = document.getElementById('toolkitSkillDialogClose');

const projectDialogBackdrop = document.getElementById('toolkitProjectDialogBackdrop');
const projectForm = document.getElementById('toolkitProjectForm');
const projectNameInput = document.getElementById('toolkitProjectName');
const projectUrlInput = document.getElementById('toolkitProjectUrl');
const projectDescInput = document.getElementById('toolkitProjectDesc');
const projectTagsInput = document.getElementById('toolkitProjectTagsInput');
const projectTagField = document.getElementById('toolkitProjectTagField');
const projectErrorEl = document.getElementById('toolkitProjectError');
const projectCancelButton = document.getElementById('toolkitProjectCancel');
const projectDialogCloseButton = document.getElementById('toolkitProjectDialogClose');

const loginDialogBackdrop = document.getElementById('toolkitLoginDialogBackdrop');
const loginForm = document.getElementById('toolkitLoginForm');
const emailInput = document.getElementById('toolkitEmail');
const passwordInput = document.getElementById('toolkitPassword');
const loginErrorEl = document.getElementById('toolkitLoginError');
const loginCancelButton = document.getElementById('toolkitLoginCancel');
const loginDialogCloseButton = document.getElementById('toolkitLoginDialogClose');

function renderSkills() {
  skillsList.innerHTML = skills.length
    ? skills.map((skill) => skillRowHTML(skill, isLoggedIn)).join('')
    : emptyStateHTML('还没有 Skill，点击右上角「添加 Skill」开始收藏吧');
}

function renderProjects() {
  projectsGrid.innerHTML = projects.length
    ? projects.map((project) => projectCardHTML(project, isLoggedIn)).join('')
    : emptyStateHTML('还没有 Project，点击右上角「添加 Project」开始收藏吧');
}

function applyAuthState(session) {
  isLoggedIn = Boolean(session);
  loginButton.hidden = isLoggedIn;
  logoutButton.hidden = !isLoggedIn;
  addSkillButton.hidden = !isLoggedIn;
  addProjectButton.hidden = !isLoggedIn;
  renderSkills();
  renderProjects();
}

async function loadToolkitData() {
  statusEl.hidden = false;
  statusEl.textContent = 'Loading toolkit…';
  try {
    const [skillRows, projectRows] = await Promise.all([
      fetchToolkitSkills(),
      fetchToolkitProjects(),
    ]);
    skills = skillRows.map(supabaseRowToItem);
    projects = projectRows.map(supabaseRowToItem);
    renderSkills();
    renderProjects();
    statusEl.hidden = true;
  } catch (error) {
    statusEl.textContent = `Failed to load toolkit: ${error.message}`;
  }
}

function updateTagsDisplay(container, field, tags) {
  container.querySelectorAll('.toolkit-tag-chip').forEach((chip) => chip.remove());
  tags.forEach((tag, index) => {
    const chip = document.createElement('span');
    chip.className = 'toolkit-tag-chip';
    chip.innerHTML = `${tag}<span class="toolkit-tag-chip__remove" data-index="${index}">×</span>`;
    container.insertBefore(chip, field);
  });
}

function handleTagFieldKeydown(field, tags, container) {
  return (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const value = field.value.trim();
    if (value && !tags.includes(value)) {
      tags.push(value);
      field.value = '';
      updateTagsDisplay(container, field, tags);
    }
  };
}

function handleTagsContainerClick(tags, container, field) {
  return (event) => {
    if (!event.target.classList.contains('toolkit-tag-chip__remove')) return;
    const index = Number(event.target.dataset.index);
    tags.splice(index, 1);
    updateTagsDisplay(container, field, tags);
  };
}

skillTagField.addEventListener('keydown', handleTagFieldKeydown(skillTagField, skillTags, skillTagsInput));
skillTagsInput.addEventListener('click', handleTagsContainerClick(skillTags, skillTagsInput, skillTagField));

projectTagField.addEventListener('keydown', handleTagFieldKeydown(projectTagField, projectTags, projectTagsInput));
projectTagsInput.addEventListener('click', handleTagsContainerClick(projectTags, projectTagsInput, projectTagField));

function openSkillDialog() {
  skillDialogBackdrop.hidden = false;
  skillNameInput.focus();
}

function closeSkillDialog() {
  skillDialogBackdrop.hidden = true;
  skillForm.reset();
  skillTags = [];
  updateTagsDisplay(skillTagsInput, skillTagField, skillTags);
  skillErrorEl.hidden = true;
}

function openProjectDialog() {
  projectDialogBackdrop.hidden = false;
  projectNameInput.focus();
}

function closeProjectDialog() {
  projectDialogBackdrop.hidden = true;
  projectForm.reset();
  projectTags = [];
  updateTagsDisplay(projectTagsInput, projectTagField, projectTags);
  projectErrorEl.hidden = true;
}

function openLoginDialog() {
  loginDialogBackdrop.hidden = false;
  emailInput.focus();
}

function closeLoginDialog() {
  loginDialogBackdrop.hidden = true;
  loginForm.reset();
  loginErrorEl.hidden = true;
}

addSkillButton.addEventListener('click', openSkillDialog);
skillCancelButton.addEventListener('click', closeSkillDialog);
skillDialogCloseButton.addEventListener('click', closeSkillDialog);
skillDialogBackdrop.addEventListener('click', (event) => {
  if (event.target === skillDialogBackdrop) closeSkillDialog();
});

addProjectButton.addEventListener('click', openProjectDialog);
projectCancelButton.addEventListener('click', closeProjectDialog);
projectDialogCloseButton.addEventListener('click', closeProjectDialog);
projectDialogBackdrop.addEventListener('click', (event) => {
  if (event.target === projectDialogBackdrop) closeProjectDialog();
});

loginButton.addEventListener('click', openLoginDialog);
loginCancelButton.addEventListener('click', closeLoginDialog);
loginDialogCloseButton.addEventListener('click', closeLoginDialog);
loginDialogBackdrop.addEventListener('click', (event) => {
  if (event.target === loginDialogBackdrop) closeLoginDialog();
});

logoutButton.addEventListener('click', async () => {
  await signOut();
});

skillForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submission = buildItemSubmission({
    name: skillNameInput.value,
    url: skillUrlInput.value,
    description: skillDescInput.value,
    tags: skillTags,
  });
  if (!submission.valid) {
    skillErrorEl.textContent = submission.errors.join(' ');
    skillErrorEl.hidden = false;
    return;
  }
  try {
    await insertToolkitSkill(submission.row);
    closeSkillDialog();
    await loadToolkitData();
  } catch (error) {
    skillErrorEl.textContent = error.message;
    skillErrorEl.hidden = false;
  }
});

projectForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submission = buildItemSubmission({
    name: projectNameInput.value,
    url: projectUrlInput.value,
    description: projectDescInput.value,
    tags: projectTags,
  });
  if (!submission.valid) {
    projectErrorEl.textContent = submission.errors.join(' ');
    projectErrorEl.hidden = false;
    return;
  }
  try {
    await insertToolkitProject(submission.row);
    closeProjectDialog();
    await loadToolkitData();
  } catch (error) {
    projectErrorEl.textContent = error.message;
    projectErrorEl.hidden = false;
  }
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await signIn(emailInput.value, passwordInput.value);
    closeLoginDialog();
  } catch {
    loginErrorEl.textContent = 'Incorrect email or password.';
    loginErrorEl.hidden = false;
  }
});

skillsList.addEventListener('click', async (event) => {
  const button = event.target.closest('.skill-delete');
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  if (!window.confirm('确定要删除这个 Skill 吗？')) return;
  await deleteToolkitSkill(button.dataset.id);
  await loadToolkitData();
});

projectsGrid.addEventListener('click', async (event) => {
  const button = event.target.closest('.project-delete');
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  if (!window.confirm('确定要删除这个 Project 吗？')) return;
  await deleteToolkitProject(button.dataset.id);
  await loadToolkitData();
});

// ===== Galaxy background =====
(function setupGalaxyCanvas() {
  const canvas = document.getElementById('toolkitGalaxyCanvas');
  const ctx = canvas.getContext('2d');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  let width;
  let height;
  let stars = [];
  const mouse = { x: -1000, y: -1000 };

  const STAR_COUNT = 110;
  const COLORS = ['#002FA7', '#1a4fc7', '#335fc2'];
  const MOUSE_INFLUENCE = 130;

  class Star {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.baseX = this.x;
      this.baseY = this.y;
      this.size = Math.random() * 1.8 + 0.4;
      this.vx = (Math.random() - 0.5) * 0.02;
      this.vy = (Math.random() - 0.5) * 0.02;
      this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
      this.alpha = Math.random() * 0.3 + 0.12;
      this.twinkle = Math.random() * Math.PI * 2;
      this.twinkleSpeed = Math.random() * 0.02 + 0.01;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;

      if (this.x < 0) this.x = width;
      if (this.x > width) this.x = 0;
      if (this.y < 0) this.y = height;
      if (this.y > height) this.y = 0;

      const dx = this.x - mouse.x;
      const dy = this.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MOUSE_INFLUENCE) {
        const force = (MOUSE_INFLUENCE - dist) / MOUSE_INFLUENCE;
        this.x += (dx / dist) * force * 2;
        this.y += (dy / dist) * force * 2;
      }

      this.x += (this.baseX - this.x) * 0.01;
      this.y += (this.baseY - this.y) * 0.01;
      this.twinkle += this.twinkleSpeed;
    }

    draw() {
      const twinkleAlpha = this.alpha * (0.6 + 0.4 * Math.sin(this.twinkle));
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `${this.color}${Math.floor(twinkleAlpha * 255).toString(16).padStart(2, '0')}`;
      ctx.fill();
    }
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);
    stars.forEach((star) => {
      star.update();
      star.draw();
    });
    for (let i = 0; i < stars.length; i += 1) {
      for (let j = i + 1; j < stars.length; j += 1) {
        const dx = stars[i].x - stars[j].x;
        const dy = stars[i].y - stars[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 90) {
          ctx.beginPath();
          ctx.moveTo(stars[i].x, stars[i].y);
          ctx.lineTo(stars[j].x, stars[j].y);
          ctx.strokeStyle = `rgba(0, 47, 167, ${0.06 * (1 - dist / 90)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(animate);
  }

  resize();
  stars = Array.from({ length: STAR_COUNT }, () => new Star());
  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  });
  animate();
})();

onAuthStateChange((session) => applyAuthState(session));
getSession().then(applyAuthState);
loadToolkitData();
