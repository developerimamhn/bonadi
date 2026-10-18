/** Site-wide business details. Edit here once — Contact page, footer and the call button all read from this file. */
export const SITE = {
  phone: "+880 1744-483744",
  tel: "+8801744483744",
  address: "Kaliganj, Satkhira, Bangladesh",      // from the product label
  mapQuery: "Kaliganj, Satkhira, Bangladesh",
  email: "",                                       // add a business email to show it on the site
  social: { facebook: "", instagram: "", youtube: "" },   // paste full URLs; icons with an empty URL are hidden
};

/** FAQ shown on the home page. Only write answers you can honestly stand behind — edit freely. */
export const FAQ = [
  ["What is BONADI Gawa Ghee?", "Pure cow ghee from Satkhira, Kaliganj, Bangladesh, labelled 100% natural. The jar sizes available are shown in the shop."],
  ["How do I pay?", "Cash on Delivery for now. bKash, Nagad and card payments are not available yet."],
  ["What does delivery cost, and how does it work?", "Delivery is free at the moment. After you place an order we call you to confirm your address and delivery."],
  ["What if I am not satisfied?", "You have a 7-day return guarantee. Tell us within 7 days of delivery and choose a cash refund or a replacement product."],
  ["How can I contact BONADI?", `Call ${"+880 1744-483744"} or use the contact page — we are happy to help.`],
];

/** Policy pages (#/policy/delivery|returns|privacy|terms). Plain facts only — BONADI can edit or extend any text here. */
export const POLICIES = {
  delivery: { title: "Delivery Policy",
    en: ["Delivery is free at the moment.", "After you place an order, we call the phone number you gave to confirm your address and delivery."],
    bn: ["এই মুহূর্তে ডেলিভারি ফ্রি।", "অর্ডার করার পর আপনার দেওয়া ফোন নম্বরে কল করে আমরা ঠিকানা ও ডেলিভারি নিশ্চিত করি।"] },
  returns: { title: "Return & Refund",
    en: ["7-day return guarantee: if you are not satisfied with your BONADI order, tell us within 7 days of delivery.", "You can choose a cash refund or a replacement product.", "To start a return, call +880 1744-483744 or write to us from the contact page."],
    bn: ["৭ দিনের রিটার্ন গ্যারান্টি: বোনাদির অর্ডারে সন্তুষ্ট না হলে ডেলিভারির ৭ দিনের মধ্যে আমাদের জানান।", "আপনি ক্যাশ রিফান্ড অথবা বদলি পণ্য — যেকোনো একটি বেছে নিতে পারবেন।", "রিটার্ন শুরু করতে +880 1744-483744 নম্বরে কল করুন অথবা যোগাযোগ পেজ থেকে আমাদের লিখুন।"] },
  privacy: { title: "Privacy Policy",
    en: ["When you order, we collect your name, phone number, delivery address and the items you ordered, so we can deliver your order.", "If you create an account we also store your email address and, if you add it, your bKash/Nagad payout number for commissions.", "This information is stored with our database provider, Supabase. Passwords are handled by Supabase Authentication.", "To ask about your data, call +880 1744-483744 or use the contact page."],
    bn: ["অর্ডার করার সময় আমরা আপনার নাম, ফোন নম্বর, ডেলিভারির ঠিকানা এবং অর্ডার করা পণ্যের তথ্য নিই, যাতে অর্ডারটি পৌঁছে দিতে পারি।", "অ্যাকাউন্ট খুললে আপনার ইমেইল এবং (দিলে) কমিশনের জন্য বিকাশ/নগদ নম্বরও আমরা সংরক্ষণ করি।", "এই তথ্য আমাদের ডাটাবেস সেবাদাতা Supabase-এ সংরক্ষিত থাকে। পাসওয়ার্ড Supabase Authentication পরিচালনা করে।", "আপনার তথ্য সম্পর্কে জানতে +880 1744-483744 নম্বরে কল করুন বা যোগাযোগ পেজ ব্যবহার করুন।"] },
  terms: { title: "Terms of Use",
    en: ["By placing an order you confirm that the name, phone number and address you gave are correct.", "Prices are in Bangladeshi Taka (৳). The final price is confirmed by our server when you place the order.", "Payment is Cash on Delivery for now."],
    bn: ["অর্ডার করার মাধ্যমে আপনি নিশ্চিত করছেন যে আপনার দেওয়া নাম, ফোন নম্বর ও ঠিকানা সঠিক।", "দাম বাংলাদেশি টাকায় (৳)। অর্ডার করার সময় আমাদের সার্ভার চূড়ান্ত দাম নিশ্চিত করে।", "আপাতত পেমেন্ট ক্যাশ অন ডেলিভারি।"] },
};
