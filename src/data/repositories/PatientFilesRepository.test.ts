// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '../../lib/supabaseClient';
import {
  ACTIVE_CLINIC_REQUIRED_ERROR,
  MAX_PATIENT_FILE_SIZE_BYTES,
  PATIENT_FILES_BUCKET,
  SupabasePatientFilesRepository,
  LocalPatientFilesRepository,
  validatePatientImageFile,
} from './PatientFilesRepository';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    storage: { from: vi.fn() },
  },
}));

function imageFile(name = 'photo.png', size = 10, type = 'image/png') {
  return new File([new Uint8Array(size)], name, { type });
}

describe('PatientFilesRepository', () => {
  const tenantId = '11111111-1111-1111-1111-111111111111';
  const patientId = '22222222-2222-2222-2222-222222222222';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('33333333-3333-3333-3333-333333333333');
  });

  it('requires active tenant for Supabase file access', () => {
    expect(() => new SupabasePatientFilesRepository(undefined)).toThrow(ACTIVE_CLINIC_REQUIRED_ERROR);
  });

  it('rejects non-image, empty, and oversized files', () => {
    expect(() => validatePatientImageFile(new File(['x'], 'doc.txt', { type: 'text/plain' }))).toThrow('только изображения');
    expect(() => validatePatientImageFile(new File([], 'empty.png', { type: 'image/png' }))).toThrow('Файл пустой');
    expect(() => validatePatientImageFile(imageFile('big.png', MAX_PATIENT_FILE_SIZE_BYTES + 1))).toThrow('10 МБ');
  });

  it('uploads to patient-files bucket with tenant-scoped path and inserts metadata', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: 'signed-url' }, error: null });
    const insert = vi.fn().mockReturnThis();
    const select = vi.fn().mockReturnThis();
    const single = vi.fn().mockResolvedValue({
      data: {
        id: '33333333-3333-3333-3333-333333333333', tenant_id: tenantId, patient_id: patientId,
        storage_path: `${tenantId}/patients/${patientId}/dental-photos/33333333-3333-3333-3333-333333333333-photo.png`,
        original_filename: 'photo.png', mime_type: 'image/png', size_bytes: 10,
        file_kind: 'dental_photo', source_context: 'dental_chart', is_archived: false,
        created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      },
      error: null,
    });

    (supabase as unknown as { storage: { from: ReturnType<typeof vi.fn> }, from: ReturnType<typeof vi.fn> }).storage.from.mockReturnValue({ upload, createSignedUrl });
    (supabase as unknown as { from: ReturnType<typeof vi.fn> }).from.mockReturnValue({ insert, select, single });

    const repo = new SupabasePatientFilesRepository(tenantId, 'user-id');
    const result = await repo.uploadPatientFile({ patientId, file: imageFile() });

    expect((supabase as unknown as { storage: { from: ReturnType<typeof vi.fn> } }).storage.from).toHaveBeenCalledWith(PATIENT_FILES_BUCKET);
    expect(upload).toHaveBeenCalledWith(expect.stringContaining(`${tenantId}/patients/${patientId}/dental-photos/`), expect.any(File), expect.objectContaining({ contentType: 'image/png' }));
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ tenant_id: tenantId, patient_id: patientId, mime_type: 'image/png', size_bytes: 10 }));
    expect(result.previewUrl).toBe('signed-url');
  });

  it('cleans up uploaded object if metadata insert fails', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    (supabase as unknown as { storage: { from: ReturnType<typeof vi.fn> }, from: ReturnType<typeof vi.fn> }).storage.from.mockReturnValue({ upload, remove });
    (supabase as unknown as { from: ReturnType<typeof vi.fn> }).from.mockReturnValue({
      insert: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: new Error('metadata failed') }),
    });

    const repo = new SupabasePatientFilesRepository(tenantId);
    await expect(repo.uploadPatientFile({ patientId, file: imageFile() })).rejects.toThrow('metadata failed');
    expect(remove).toHaveBeenCalledWith([expect.stringContaining(`${tenantId}/patients/${patientId}/dental-photos/`)]);
  });

  it('lists active files by tenant and patient and generates signed URLs', async () => {
    const eq = vi.fn().mockReturnThis();
    const order = vi.fn().mockResolvedValue({
      data: [{ id: 'file-1', tenant_id: tenantId, patient_id: patientId, storage_path: `${tenantId}/x.png`, original_filename: 'x.png', mime_type: 'image/png', size_bytes: 1, file_kind: 'dental_photo', source_context: 'dental_chart', is_archived: false, created_at: 'now', updated_at: 'now' }],
      error: null,
    });
    (supabase as unknown as { from: ReturnType<typeof vi.fn>, storage: { from: ReturnType<typeof vi.fn> } }).from.mockReturnValue({ select: vi.fn().mockReturnThis(), eq, order });
    (supabase as unknown as { storage: { from: ReturnType<typeof vi.fn> } }).storage.from.mockReturnValue({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'signed' }, error: null }) });

    const repo = new SupabasePatientFilesRepository(tenantId);
    const files = await repo.listPatientFiles(patientId);

    expect(eq).toHaveBeenCalledWith('tenant_id', tenantId);
    expect(eq).toHaveBeenCalledWith('patient_id', patientId);
    expect(eq).toHaveBeenCalledWith('is_archived', false);
    expect(files[0].previewUrl).toBe('signed');
  });

  it('archives file metadata instead of deleting', async () => {
    const eq = vi.fn().mockReturnThis();
    const update = vi.fn().mockReturnValue({ eq });
    (supabase as unknown as { from: ReturnType<typeof vi.fn> }).from.mockReturnValue({ update });
    eq.mockReturnValueOnce({ eq }).mockResolvedValueOnce({ error: null });

    const repo = new SupabasePatientFilesRepository(tenantId, 'user-id');
    await repo.archivePatientFile('file-id');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ is_archived: true, archived_by: 'user-id' }));
  });

  it('local repository does not use Supabase', async () => {
    const repo = new LocalPatientFilesRepository();
    await repo.uploadPatientFile({ patientId, file: imageFile('local.png') });
    const files = await repo.listPatientFiles(patientId);
    expect(files[0].originalFilename).toBe('local.png');
    expect((supabase as unknown as { from: ReturnType<typeof vi.fn> }).from).not.toHaveBeenCalled();
  });
});
