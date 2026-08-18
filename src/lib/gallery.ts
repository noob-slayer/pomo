export interface GalleryPainting {
  id: string;
  label: string;
  src: string;
}

// curated backdrops for the "reveal" theme's carousel -- add more entries here to widen
// the rotation, no other code needs to change
export const GALLERY: GalleryPainting[] = [
  { id: "klimt-lady-with-fan", label: "Lady with a Fan — Gustav Klimt", src: "/gallery/bio_box_klimt_gustav.jpg" },
];
