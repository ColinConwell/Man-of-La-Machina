import { test, expect } from '../../../apps/web/node_modules/@playwright/test/index.mjs';

async function threeInstructions(page) {
  await page.route('**/cases/*/setup', async route => {
    const response = await route.fetch(), graph = await response.json();
    const instructions = graph.nodes.find(n => n.origin === 'instruction');
    instructions.item_count = 3;
    instructions.references.find(r => r.call_id === 'author').positions = [0,3,4];
    await route.fulfill({response, json:graph});
  });
  await page.route('**/receipts/author', async route => {
    const response = await route.fetch(), receipt = await response.json();
    receipt.manifest.items.push(
      {id:'second-instruction',role:'user',origin:'instruction',position:3,body:'SECOND PROMPT: keep the terminal event in view.'},
      {id:'third-instruction',role:'user',origin:'instruction',position:4,body:'THIRD PROMPT: finish when the Traveler reaches the inn.'});
    receipt.display_projection = {mode:'aliases',content_changed:true,source_hashes_preserved:true};
    receipt.display_payload_hash = 'projected-fixture-hash';
    await route.fulfill({response,json:receipt});
  });
}

test('node click immediately reveals searchable prompt preview with focus return and provenance', async ({page}) => {
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await threeInstructions(page);
  await page.goto('/');
  await page.getByRole('tab',{name:'Setup',exact:true}).click();
  const instructions=page.locator('.graph-input').filter({hasText:'Instructions'});
  await instructions.click();
  const preview=page.getByRole('dialog',{name:'Instructions',exact:true});
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('Alias-projected display of saved content. Original receipt hashes are preserved.');
  await expect(preview.locator('.node-preview-body > pre')).toContainText('EXACT AUTHOR PROMPT');
  await expect(preview.getByRole('button',{name:'Close Node Preview'})).toBeFocused();
  await preview.getByRole('searchbox').fill('SECOND PROMPT');
  await expect(preview.locator('.node-preview-body > pre')).toContainText('SECOND PROMPT');
  await expect(preview.locator('.node-preview-count')).toHaveText('1 of 3 blocks');
  await preview.getByRole('searchbox').fill('');
  await preview.getByRole('combobox',{name:'Preview Input Block'}).selectOption('4:third-instruction');
  await expect(preview.locator('.node-preview-body > pre')).toContainText('THIRD PROMPT');
  await preview.getByText('All 3 Input Blocks · Full Text',{exact:true}).click();
  await expect(preview.locator('.node-preview-all')).toContainText('SECOND PROMPT');
  await preview.getByText('Alias-Projected Native Provider Payload',{exact:true}).click();
  await expect(preview.locator('.node-preview-native pre')).toBeVisible();
  await expect(preview.locator('.node-preview-provenance')).toContainText('author-payload');
  await expect(preview.locator('.node-preview-provenance')).toContainText('projected-fixture-hash');
  await page.keyboard.press('Escape');
  await expect(preview).toHaveCount(0);
  await expect(instructions).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({path:'/tmp/machina-node-preview-desktop.png'});
  await page.getByRole('button',{name:'Close Node Preview'}).click();
  await expect(instructions).toBeFocused();
  expect(errors).toEqual([]);
});

test('touch-sized modal remains in the viewport and output preview is immediately readable', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await page.getByRole('tab',{name:'Setup',exact:true}).click();
  await page.locator('.graph-output').click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.locator('.node-preview-body > pre')).toContainText('Invented complete script.');
  const box=await dialog.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x+box.width).toBeLessThanOrEqual(390); expect(box.y+box.height).toBeLessThanOrEqual(844);
  await page.screenshot({path:'/tmp/machina-node-preview-mobile.png'});
  await dialog.getByRole('button',{name:'Close Node Preview'}).click();
  await expect(dialog).toHaveCount(0);
});
