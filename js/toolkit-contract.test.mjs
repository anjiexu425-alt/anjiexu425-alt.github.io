import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Toolkit page wires the ids and script that toolkit.js depends on', async () => {
  const [html, script] = await Promise.all([
    readFile(new URL('../toolkit.html', import.meta.url), 'utf8'),
    readFile(new URL('./toolkit.js', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /<link rel="stylesheet" href="css\/toolkit\.css" \/>/);
  assert.match(html, /<canvas id="toolkitGalaxyCanvas"/);
  assert.match(html, /<script type="module" src="js\/toolkit\.js">/);
  assert.match(html, /href="toolkit\.html" aria-current="page"/);

  const requiredIds = [
    'toolkitGalaxyCanvas',
    'toolkitSkillsList',
    'toolkitProjectsGrid',
    'toolkitStatus',
    'toolkitLoginButton',
    'toolkitLogoutButton',
    'toolkitAddSkillButton',
    'toolkitAddProjectButton',
    'toolkitSkillDialogBackdrop',
    'toolkitSkillForm',
    'toolkitSkillName',
    'toolkitSkillUrl',
    'toolkitSkillDesc',
    'toolkitSkillTagsInput',
    'toolkitSkillTagField',
    'toolkitSkillError',
    'toolkitSkillCancel',
    'toolkitSkillDialogClose',
    'toolkitProjectDialogBackdrop',
    'toolkitProjectForm',
    'toolkitProjectName',
    'toolkitProjectUrl',
    'toolkitProjectDesc',
    'toolkitProjectTagsInput',
    'toolkitProjectTagField',
    'toolkitProjectError',
    'toolkitProjectCancel',
    'toolkitProjectDialogClose',
    'toolkitLoginDialogBackdrop',
    'toolkitLoginForm',
    'toolkitEmail',
    'toolkitPassword',
    'toolkitLoginError',
    'toolkitLoginCancel',
    'toolkitLoginDialogClose',
  ];

  for (const id of requiredIds) {
    assert.match(html, new RegExp(`id="${id}"`), `expected toolkit.html to contain id="${id}"`);
  }

  const idsScriptShouldReference = requiredIds.filter((id) => id !== 'toolkitGalaxyCanvas');
  for (const id of idsScriptShouldReference) {
    assert.match(
      script,
      new RegExp(`getElementById\\('${id}'\\)`),
      `expected toolkit.js to reference getElementById('${id}')`,
    );
  }
  assert.match(script, /getElementById\('toolkitGalaxyCanvas'\)/);
});
