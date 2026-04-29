import GiftCardProvider from "../GiftCardProvider";

const MOCK_CARDS = [
  {
    id: "gc_amazon_01",
    brand: "Amazon",
    type: "Digital",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg",
    bgColor: "#232F3E",
    textColor: "#ffffff",
    denominations: [500, 1000, 2500, 5000],
    discountPercent: 2,
    validityDays: 365,
    description: "Use this gift card to shop from millions of items on Amazon.",
  },
  {
    id: "gc_flipkart_01",
    brand: "Flipkart",
    type: "Digital",
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/7/7a/Flipkart_logo.svg",
    bgColor: "#047BD5",
    textColor: "#ffffff",
    denominations: [500, 1000, 2000],
    discountPercent: 1.5,
    validityDays: 365,
    description: "The perfect gift for every occasion, shop electronics, fashion, and more.",
  },
  {
    id: "gc_starbucks_01",
    brand: "Starbucks",
    type: "Digital",
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/d/d3/Starbucks_Corporation_Logo_2011.svg",
    bgColor: "#00704A",
    textColor: "#ffffff",
    denominations: [200, 500, 1000],
    discountPercent: 5,
    validityDays: 180,
    description: "Treat your friends and family to their favorite coffee.",
  },
  {
    id: "gc_myntra_01",
    brand: "Myntra",
    type: "Digital",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/b/bc/Myntra_Logo_Light.png",
    bgColor: "#F13AB1",
    textColor: "#ffffff",
    denominations: [1000, 2000, 5000],
    discountPercent: 3,
    validityDays: 365,
    description: "Gift the latest fashion trends from top brands.",
  }
];

class MockGiftCardProvider extends GiftCardProvider {
  async getAvailableCards() {
    // Simulate network delay
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(MOCK_CARDS);
      }, 600);
    });
  }

  async getCardDetails(id) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const card = MOCK_CARDS.find(c => c.id === id);
        if (card) resolve(card);
        else reject(new Error("Gift card not found"));
      }, 300);
    });
  }

  async purchaseCard(id, amount, options = {}) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          transactionId: "TXN_" + Math.random().toString(36).substr(2, 9).toUpperCase(),
          purchasedCard: {
            id,
            amount,
            code: "MOCK-" + Math.random().toString(36).substr(2, 8).toUpperCase(),
            purchasedAt: new Date().toISOString(),
          }
        });
      }, 1000);
    });
  }
}

export default MockGiftCardProvider;
