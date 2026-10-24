// SAMPLE DATA: the running job on /home and on the landing page's hero card, labelled as a sample
// there, until T12 (the customer's real orders) and T28 (the cleaner assigned to a job) replace it.
// The services, prices and areas are real since T8 (src/lib/catalog/cached.ts).
// Everything here is fictional: the job and the cleaner "Wulan Anggraeni" (a stock photo with an
// invented name; credits in markdown/image-sources.md). The words people read (the service name, the
// time, the photo's alt text) are in the PreviewData namespace of src/messages/*.json.
// One brand to the customer (markdown/PRODUCT.md principle 6): nothing here names who supplies the cleaners.

/** A photo in public/images, with its intrinsic size so next/image can reserve the space. */
export type PreviewPhoto = { src: string; width: number; height: number };

export type PreviewCleaner = { name: string; photo: PreviewPhoto };

export type PreviewJob = {
  /** Times as shown in both languages (24-hour clock with a dot, the Indonesian convention). */
  checkedInAt: string;
  finishesAround: string;
  cleaner: PreviewCleaner;
};

export const previewCleaner: PreviewCleaner = {
  name: "Wulan Anggraeni",
  photo: { src: "/images/cleaner-avatar.jpg", width: 400, height: 400 },
};

export const previewJob: PreviewJob = {
  checkedInAt: "09.04",
  finishesAround: "11.00",
  cleaner: previewCleaner,
};
