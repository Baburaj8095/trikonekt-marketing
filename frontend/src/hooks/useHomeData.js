export default function useHomeData() {
  return {
    heroBanners: ["/banner1.jpg", "/banner2.jpg"],
    categories: [
      { label: "Electronics" },
      { label: "Furniture" },
      { label: "EV" },
      { label: "Local" }
    ],
    deals: [{ label: "Spin & Win", image: "/spin.png" }],
    isPrime: false,
    electronics: [{ id: 1, name: "TV", image: "/tv.jpg", price: 30000 }],
    furniture: [{ id: 2, name: "Sofa", image: "/sofa.jpg", price: 20000 }],
    ev: [{ id: 3, name: "E-Bike", image: "/ebike.jpg", price: 50000 }],
    services: [{ label: "Orders" }, { label: "Wallet" }]
  };
}
