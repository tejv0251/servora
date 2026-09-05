import assert from 'node:assert/strict';
import test from 'node:test';

import {
  attachmentObjectKey,
  contentDisposition,
  MAX_ATTACHMENT_BYTES,
  safeAttachmentName,
  validateAttachment,
} from '../lib/attachment-policy';

test('attachment policy accepts supported files and rejects mismatches', () => {
  assert.equal(
    validateAttachment({
      name: 'completion photo.jpg',
      type: 'image/jpeg',
      size: 42,
    }),
    null,
  );
  assert.match(
    validateAttachment({ name: 'photo.exe', type: 'image/jpeg', size: 42 }) ??
      '',
    /PDF, JPG, PNG, or WebP/,
  );
  assert.match(
    validateAttachment({
      name: 'large.pdf',
      type: 'application/pdf',
      size: MAX_ATTACHMENT_BYTES + 1,
    }) ?? '',
    /8 MB/,
  );
  assert.match(
    validateAttachment({
      name: 'empty.pdf',
      type: 'application/pdf',
      size: 0,
    }) ?? '',
    /empty/,
  );
});

test('attachment names and object keys are safe and tenant-scoped', () => {
  assert.equal(
    safeAttachmentName('../signed:report?.pdf'),
    '..-signed-report-.pdf',
  );
  assert.equal(
    attachmentObjectKey('ws_1', 'job_1', 'att_1', 'signed report.pdf'),
    'workspaces/ws_1/jobs/job_1/att_1-signed report.pdf',
  );
  assert.match(
    contentDisposition('résumé.pdf'),
    /^inline; filename="r_sum_\.pdf";/,
  );
});
