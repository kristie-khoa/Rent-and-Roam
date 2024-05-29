mapboxgl.accessToken = mapToken;

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/streets-v12",
  center: listing.geometry.coordinates,
  zoom: 13,
});

map.addControl(new mapboxgl.NavigationControl());

const marker1 = new mapboxgl.Marker()
  .setLngLat(listing.geometry.coordinates)
  .setPopup(
    new mapboxgl.Popup({ offset: 25 }).setHTML(
      `<h6 class="mb-0" >${listing.title}</h6>`
    )
  )
  .addTo(map);
