/**
 * Tiny i18n: Bangla (default) + English. t("English text") returns Bangla when the language is "bn" and a translation exists.
 * Add a new line to BN to translate any string. The toggle lives in the navbar; the choice is remembered.
 */
let lang = "bn";
try { lang = localStorage.getItem("bonadi-lang") || "bn"; } catch { /* private mode */ }
if (typeof document !== "undefined") document.documentElement.lang = lang;

export const getLang = () => lang;
export function setLang(l) { lang = l; try { localStorage.setItem("bonadi-lang", l); } catch { /* ignore */ } document.documentElement.lang = l; }
export const t = (s) => (lang === "bn" && BN[s]) || s;
/** Product name in the current language (uses the name_bn column when available) */
export const pname = (p) => (lang === "bn" && p.name_bn) || p.name;

export const BN = {
  // navigation
  Home: "হোম", Shop: "শপ", About: "আমাদের সম্পর্কে", Contact: "যোগাযোগ", "Track order": "অর্ডার ট্র্যাক", Cart: "কার্ট", "Order Now": "এখনই অর্ডার করুন", Account: "অ্যাকাউন্ট", "Log in": "লগ ইন", "Dark mode": "ডার্ক মোড", "Light mode": "লাইট মোড",
  // hero
  "Satkhira · Bangladesh": "সাতক্ষীরা থেকে", "Pure Food,": "খাঁটি", "Honest Promise.": "গাওয়া ঘি",
  "Authentic gawa ghee, natural honey and more — made with care and delivered to your door.": "সাতক্ষীরা থেকে, সরাসরি আপনার ঘরে।",
  "Shop Now": "ঘি কিনুন", "Try the 3D Store": "৩ডি স্টোরে ঘুরে দেখুন", "100% Natural": "১০০% প্রাকৃতিক", "Free delivery": "ডেলিভারি একদম ফ্রি", "Cash on Delivery": "হাতে পেয়ে টাকা দিন",
  // home
  "What Makes Bonadi Special": "বোনাদি থেকে কিনলে আপনি যা পাচ্ছেন", "Five promises we keep with every jar, bottle and box.": "ঝুঁকি আমাদের, নিশ্চিন্ত আপনি — প্রতিটি অর্ডারে পাঁচটি প্রতিশ্রুতি।",
  "100% Authentic": "১০০% খাঁটি, ১০০% নিশ্চিন্ত", "Carefully selected, quality ingredients.": "বাছাই করা মানসম্পন্ন উপাদান — খাঁটি না মনে হলে ৭ দিনের মধ্যে জানান, ফেরত নেব।",
  "Traditional Taste": "দাদি-নানির রান্নার সেই স্বাদ", "Bringing the authentic taste of our heritage to your table.": "প্রথম চামচেই টের পাবেন ঐতিহ্যের খাঁটি স্বাদ — আপনার প্রতিদিনের খাবারে।",
  "Quality You Can Trust": "ঝুঁকি ছাড়া কিনুন", "Made with care and attention to quality.": "আগে পণ্য হাতে নিন, তারপর টাকা দিন। পছন্দ না হলে ক্যাশ রিফান্ড অথবা বদলি পণ্য।",
  "Pure & Natural": "যা দরকার শুধু তা-ই, বাড়তি কিছু নয়", "No unnecessary additives, just honest food.": "অপ্রয়োজনীয় কিছু নয় — শুধু সৎ খাবার, যা পরিবারের সবাইকে নির্দ্বিধায় খাওয়াতে পারবেন।",
  "Delivered to Your Door": "বাজারে যাওয়ার ঝামেলা নেই", "Fresh products delivered conveniently to your home.": "ঘরে বসে অর্ডার করুন, ফ্রি ডেলিভারিতে তাজা পণ্য পৌঁছে যাবে আপনার দরজায়।",
  "Our Best Sellers": "যা সবচেয়ে বেশি অর্ডার হয়", "Pure gawa ghee and natural honey — made with care.": "খাঁটি গাওয়া ঘি ও প্রাকৃতিক মধু — প্রথমবার কিনছেন? ৭ দিনের গ্যারান্টিতে নির্ভয়ে চেখে দেখুন।", "View all products": "সব পণ্য দেখুন",
  "Frequently Asked Questions": "অর্ডারের আগে যা জানতে চান", "Tried BONADI?": "বোনাদি চেখে দেখেছেন? আপনার কথাই আমাদের সেরা বিজ্ঞাপন।", "We read every message — tell us what you think.": "আমরা প্রতিটি বার্তা পড়ি — ভালো বা মন্দ, খোলাখুলি জানান।", "Contact us": "আমাদের জানান",
  "Happy customers": "সন্তুষ্ট গ্রাহক", "Orders delivered": "ডেলিভারি হওয়া অর্ডার",
  "BONADI 3D STORE": "বোনাদি ৩ডি স্টোর", "A new way to shop.": "ঘুরে ঘুরে পছন্দ করে কিনুন।", "Walk through our virtual store, browse the shelves and add your favourites to your cart.": "ভার্চুয়াল দোকানে তাক ঘুরে দেখুন, পছন্দের পণ্য বেছে কার্টে নিন।",
  // shop
  "Shop Bonadi": "খাঁটি খাবারের দোকান — বোনাদি", "Pure ghee, mustard oil and honey — delivered fresh.": "খাঁটি ঘি, সরিষার তেল ও মধু — ফ্রি ডেলিভারি, ক্যাশ অন ডেলিভারি, ৭ দিনের রিটার্ন গ্যারান্টি।",
  "Prefer to walk around?": "ঘুরে ঘুরে কিনতে ভালো লাগে?", "Try our optional 3D store — pick products from the shelves and pay at the counter.": "আমাদের ৩ডি স্টোরে ঢুকে পড়ুন — তাক থেকে পণ্য তুলুন, কাউন্টারে অর্ডার করুন। একদম দোকানে ঘোরার অনুভূতি।", "Enter 3D Store": "৩ডি স্টোরে ঢুকুন",
  "Search products": "পণ্য খুঁজুন", All: "সব", Ghee: "ঘি", Honey: "মধু", "Mustard oil": "সরিষার তেল", "Sort": "সাজান", "Featured": "সেরা পছন্দ", "Price: low to high": "দাম: কম থেকে বেশি", "Price: high to low": "দাম: বেশি থেকে কম",
  "No products match your search.": "এই নামে কোনো পণ্য পাইনি। অন্য নামে খুঁজে দেখুন।", "Clear filters": "ফিল্টার মুছুন",
  "Showing the saved product list. Live prices could not be loaded — the final price is confirmed when you order.": "সংরক্ষিত পণ্য তালিকা দেখানো হচ্ছে। লাইভ দাম লোড হয়নি; অর্ডারের সময় চূড়ান্ত দাম নিশ্চিত হবে।",
  "Coming Soon": "খুব শীঘ্রই আসছে", Add: "কার্টে নিন",
  // cart
  "Your Cart": "আপনার কার্ট", "Your cart is empty.": "কার্ট খালি। খাঁটি ঘি বা মধু দিয়ে শুরু করুন।", Total: "মোট (ডেলিভারি ফ্রি)", "Customer name": "আপনার নাম", "Phone (01XXXXXXXXX)": "ফোন (01XXXXXXXXX)", "Delivery address": "কোথায় পৌঁছে দেব? (পূর্ণ ঠিকানা)",
  "Dropship order (I earn commission)": "ড্রপশিপ অর্ডার (আমি কমিশন পাব)", "Place Order (Cash on Delivery)": "অর্ডার নিশ্চিত করুন — পণ্য হাতে পেয়ে টাকা দিন", "Clear cart": "কার্ট খালি করুন",
  "Please enter your name, a valid BD phone number and full address.": "অর্ডার পৌঁছে দিতে আপনার নাম, সঠিক বাংলাদেশি ফোন নম্বর ও পূর্ণ ঠিকানা দরকার।", "Order failed. Please try again or call us.": "অর্ডার যায়নি। আরেকবার চেষ্টা করুন অথবা আমাদের কল করুন, আমরাই অর্ডার নিয়ে নেব।", "A product is no longer available.": "দুঃখিত, একটি পণ্য এই মুহূর্তে স্টকে নেই।",
  // contact / footer / forms
  "Get in Touch": "কথা বলুন আমাদের সাথে", "Questions, bulk orders or feedback — we'd love to hear from you.": "প্রশ্ন, পাইকারি অর্ডার বা মতামত — আমরা শুনতে চাই।", "Your name": "আপনার নাম", "Email address": "ইমেইল ঠিকানা", "How can we help?": "কীভাবে সাহায্য করতে পারি?", "Send Message": "বার্তা পাঠান",
  "Please enter your name.": "আপনার নাম লিখুন।", "Enter a valid email address.": "সঠিক ইমেইল ঠিকানা দিন।", "Message must be at least 10 characters.": "বার্তা কমপক্ষে ১০ অক্ষরের হতে হবে।", "Thank you! We will reply within 24 hours.": "ধন্যবাদ! আমরা ২৪ ঘণ্টার মধ্যে উত্তর দেব।", "Could not send. Please try again.": "পাঠানো যায়নি। আবার চেষ্টা করুন।",
  "Quick Links": "দ্রুত লিংক", Newsletter: "নিউজলেটার", "Subscribe to hear from BONADI.": "নতুন পণ্য ও অফারের খবর সবার আগে পেতে সাবস্ক্রাইব করুন।", Subscribe: "সাবস্ক্রাইব", "Your email": "আপনার ইমেইল", "Please enter a valid email.": "সঠিক ইমেইল দিন।", "You're subscribed. Welcome to Bonadi!": "সাবস্ক্রাইব হয়েছে। বোনাদি পরিবারে স্বাগতম!", "Something went wrong. Try again.": "কিছু ভুল হয়েছে। আবার চেষ্টা করুন।",
  "Pure Food, Honest Promise.": "খাঁটি খাবার, সৎ প্রতিশ্রুতি — পছন্দ না হলে ৭ দিনে রিফান্ড।", Policies: "নীতিমালা", "Delivery Policy": "ডেলিভারি নীতি", "Return & Refund": "ফেরত ও রিফান্ড", "Privacy Policy": "গোপনীয়তা নীতি", "Terms of Use": "ব্যবহারের শর্ত",
  // about
  "About BONADI": "বোনাদির গল্প", "Pure Food, Honest Promise": "খাঁটি খাবার, সৎ প্রতিশ্রুতি", "Explore Products": "পণ্য দেখুন", "Why Families Trust Us": "কেন পরিবারগুলো আমাদের ভরসা করে",
  "BONADI is a premium food brand offering authentic and quality traditional foods. From pure ghee and mustard oil to natural honey, BONADI focuses on purity, great taste, quality and customer trust.": "ভেজালের ভিড়ে খাঁটি ঘি, সরিষার তেল আর মধু খুঁজে পাওয়াই কঠিন — বোনাদি সেই সমস্যার সমাধান। আমরা বিশুদ্ধতা, স্বাদ ও মানকে সবার ওপরে রাখি, আর সেই বিশ্বাসের পেছনে দাঁড়াই ৭ দিনের রিটার্ন গ্যারান্টি দিয়ে: পছন্দ না হলে ক্যাশ রিফান্ড অথবা বদলি পণ্য।",
  "Our Gawa Ghee comes from Satkhira, Kaliganj, Bangladesh and is labelled 100% natural.": "আমাদের গাওয়া ঘি আসে সাতক্ষীরা, কালিগঞ্জ থেকে, আর লেবেলে স্পষ্ট লেখা ১০০% প্রাকৃতিক।",
  // faq (config)
  "What is BONADI Gawa Ghee?": "বোনাদি গাওয়া ঘি কেন আলাদা?", "Pure cow ghee from Satkhira, Kaliganj, Bangladesh, labelled 100% natural. The jar sizes available are shown in the shop.": "সাতক্ষীরা, কালিগঞ্জের খাঁটি গরুর ঘি, লেবেলে ১০০% প্রাকৃতিক লেখা। কোন সাইজের জার আছে তা শপে দেখুন — আর পছন্দ না হলে ৭ দিনের গ্যারান্টি তো আছেই।",
  "How do I pay?": "টাকা কখন, কীভাবে দেব?", "Cash on Delivery for now. bKash, Nagad and card payments are not available yet.": "অগ্রিম কিছু দিতে হবে না। পণ্য হাতে পেয়ে ক্যাশে টাকা দিন। বিকাশ, নগদ ও কার্ড পেমেন্ট এখনো চালু হয়নি।",
  "What does delivery cost, and how does it work?": "ডেলিভারি চার্জ কত?", "Delivery is free at the moment. After you place an order we call you to confirm your address and delivery.": "এই মুহূর্তে ডেলিভারি সম্পূর্ণ ফ্রি। অর্ডারের পর আমরা আপনাকে কল করে ঠিকানা ও ডেলিভারি নিশ্চিত করি।",
  "How can I contact BONADI?": "কিছু জানার থাকলে কীভাবে যোগাযোগ করব?", "Call +880 1744-483744 or use the contact page — we are happy to help.": "+880 1744-483744 নম্বরে কল করুন বা যোগাযোগ পেজ ব্যবহার করুন — আমরা সাহায্য করতে প্রস্তুত।",
  // tracking
  "Track your order": "আপনার অর্ডার এখন কোথায়?", "Enter the order number and the phone number you used.": "অর্ডার নম্বর এবং অর্ডারে দেওয়া ফোন নম্বর লিখুন।", "Order number": "অর্ডার নম্বর", "Phone number": "ফোন নম্বর", "Track": "ট্র্যাক করুন",
  "No order found. Check the order number and phone number.": "কোনো অর্ডার পাওয়া যায়নি। অর্ডার নম্বর ও ফোন নম্বর মিলিয়ে দেখুন।", Placed: "অর্ডার হয়েছে", Confirmed: "নিশ্চিত", Packed: "প্যাক হয়েছে", Shipped: "পাঠানো হয়েছে", Delivered: "পৌঁছে গেছে", Cancelled: "বাতিল", "Order": "অর্ডার",
  // 404
  "Page not found": "পেজটি পাওয়া যায়নি", "The page you are looking for does not exist.": "আপনি যে পেজ খুঁজছেন তা নেই। চলুন, খাঁটি পণ্যের দিকে ফিরি।", "Go to homepage": "হোমে যান", "Browse the shop": "শপ দেখুন",
  "We will call you to confirm.": "অর্ডার পেয়েছি! আমরা কল করে নিশ্চিত করব। টাকা দেবেন পণ্য হাতে পেয়ে।", "Placed order": "অর্ডার", "Order not found": "অর্ডার পাওয়া যায়নি", "Searching…": "খোঁজা হচ্ছে…", "Items": "পণ্য", "Status": "অবস্থা", "Order total": "মোট মূল্য",
  "Delivery": "ডেলিভারি", Returns: "ফেরত", Privacy: "গোপনীয়তা", Terms: "শর্তাবলী", "Language": "ভাষা", "Search": "খুঁজুন", "items": "টি পণ্য",
  Recipes: "ফ্রি রেসিপি", "Ghee recipes": "ঘি দিয়ে ৫টি ফ্রি রেসিপি (আমাদের উপহার)", "Five easy recipes made better with pure gawa ghee.": "খাঁটি গাওয়া ঘি দিয়ে সহজ পাঁচটি রেসিপি — ঘি কেনার সাথে বাড়তি পাওনা, একদম ফ্রি।", Serves: "পরিবেশন", Time: "সময়", Ingredients: "উপকরণ", Method: "পদ্ধতি", "Buy BONADI Gawa Ghee": "বোনাদি গাওয়া ঘি অর্ডার করুন",
  "7-day return": "৭ দিনের রিটার্ন গ্যারান্টি", "Customer reviews": "যারা কিনেছেন তাঁরা কী বলছেন", "Verified purchase": "যাচাইকৃত ক্রেতা", "Review your order": "আপনার অভিজ্ঞতা জানান", "Your rating": "আপনার রেটিং", "Your comment (optional)": "আপনার মন্তব্য (ঐচ্ছিক)", "Submit review": "রিভিউ জমা দিন",
  "Thank you! Your review will appear after approval.": "ধন্যবাদ! অনুমোদনের পর আপনার রিভিউ দেখানো হবে।", "You already reviewed this order.": "আপনি এই অর্ডারটি আগেই রিভিউ করেছেন।",
  "What if I am not satisfied?": "পছন্দ না হলে কী হবে? (ঝুঁকি আমাদের)", "You have a 7-day return guarantee. Tell us within 7 days of delivery and choose a cash refund or a replacement product.": "আপনার জন্য ৭ দিনের রিটার্ন গ্যারান্টি। ডেলিভারির ৭ দিনের মধ্যে আমাদের জানান — ক্যাশ রিফান্ড অথবা বদলি পণ্য, যেটা আপনার পছন্দ সেটাই পাবেন। ঝুঁকিটা আমাদের, আপনার না।",
  // misc
  "Skip to content": "মূল অংশে যান", "Chat on WhatsApp": "হোয়াটসঅ্যাপে কথা বলুন", "Back to top": "উপরে যান",
  "Loading…": "লোড হচ্ছে…", "Please wait…": "একটু অপেক্ষা করুন…", Close: "বন্ধ করুন", Increase: "বাড়ান", Decrease: "কমান", Remove: "মুছুন",
  "Family size": "ফ্যামিলি সাইজ", "Best seller": "বেস্ট সেলার", New: "নতুন",
  "Premium traditional foods — pure ghee, mustard oil and natural honey made with care.": "খাঁটি ঐতিহ্যবাহী খাবার — যত্নে তৈরি গাওয়া ঘি, সরিষার তেল ও প্রাকৃতিক মধু।",
  // login / sign-up
  "Welcome back": "আবার স্বাগতম", "Create your account": "আপনার অ্যাকাউন্ট খুলুন", "Full name": "পূর্ণ নাম", Email: "ইমেইল", Password: "পাসওয়ার্ড",
  "I want a Dropshipper account (needs admin approval)": "আমি ড্রপশিপার অ্যাকাউন্ট চাই (অ্যাডমিনের অনুমোদন লাগবে)", commission: "কমিশন",
  "Payout number for commissions (optional now, add later in your account):": "কমিশন পাওয়ার নম্বর (এখন না দিলেও চলবে, পরে অ্যাকাউন্ট থেকে যোগ করা যাবে):",
  "Payout method": "পেমেন্ট মাধ্যম", "Number / account": "নম্বর / অ্যাকাউন্ট", "Forgot password?": "পাসওয়ার্ড ভুলে গেছেন?", "Sign up": "সাইন আপ",
  "New here? Create an account": "নতুন? অ্যাকাউন্ট খুলুন", "Already have an account? Log in": "আগেই অ্যাকাউন্ট আছে? লগ ইন করুন",
  "Enter your name and a password of 6+ characters.": "আপনার নাম এবং কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন।",
  "Account created! Check your email to confirm, then log in.": "অ্যাকাউন্ট খোলা হয়েছে! ইমেইলে গিয়ে নিশ্চিত করুন, তারপর লগ ইন করুন।",
  "Enter your email above first, then tap “Forgot password”.": "আগে ওপরে আপনার ইমেইল লিখুন, তারপর “পাসওয়ার্ড ভুলে গেছেন?” চাপুন।",
  "Password reset link sent — check your email.": "পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে — ইমেইল দেখুন।",
  // account
  "Please log in.": "অনুগ্রহ করে লগ ইন করুন।", "My Account": "আমার অ্যাকাউন্ট", "Your referral link": "আপনার রেফারেল লিংক", "Copy your link:": "আপনার লিংক কপি করুন:",
  "Share it. When someone orders through your link and the order is delivered, you earn": "লিংকটি শেয়ার করুন। কেউ আপনার লিংক দিয়ে অর্ডার করলে এবং অর্ডার ডেলিভারি হলে আপনি পাবেন অর্ডার মূল্যের",
  "As an approved dropshipper, on orders you place for your customers you earn": "অনুমোদিত ড্রপশিপার হিসেবে আপনার গ্রাহকদের জন্য দেওয়া অর্ডারে আপনি পাবেন",
  Copy: "কপি", "Copied ✓": "কপি হয়েছে ✓", "Choose a short code, e.g. imam": "ছোট একটি কোড দিন, যেমন imam", "Change code": "কোড বদলান",
  "Code updated ✓ (old links stop working)": "কোড বদলানো হয়েছে ✓ (পুরোনো লিংক আর কাজ করবে না)",
  "Dropshipper account": "ড্রপশিপার অ্যাকাউন্ট", "waiting for admin approval.": "অ্যাডমিনের অনুমোদনের অপেক্ষায়।",
  "Link visits": "লিংক ভিজিট", Orders: "অর্ডার", "Payable now": "এখন পাওনা", Paid: "পরিশোধিত", Pending: "অপেক্ষমাণ",
  "Commission becomes “payable” after the order is delivered and is paid to your bKash/Nagad number below. Cancelled orders earn nothing. Referral links are remembered for 30 days.": "অর্ডার ডেলিভারি হওয়ার পর কমিশন “পাওনা” হয় এবং নিচের বিকাশ/নগদ নম্বরে পাঠানো হয়। বাতিল অর্ডারে কমিশন নেই। রেফারেল লিংক ৩০ দিন মনে রাখা হয়।",
  "Profile & payout": "প্রোফাইল ও পেমেন্ট", "Payout number": "পেমেন্ট নম্বর", Save: "সেভ করুন", "Saved ✓": "সেভ হয়েছে ✓",
  "Set your new password": "নতুন পাসওয়ার্ড দিন", "Change password": "পাসওয়ার্ড বদলান", "New password": "নতুন পাসওয়ার্ড", Update: "আপডেট",
  "Use at least 6 characters.": "কমপক্ষে ৬ অক্ষর দিন।", "Password updated ✓": "পাসওয়ার্ড বদলানো হয়েছে ✓",
  "Commission history": "কমিশনের হিসাব", "No commissions yet.": "এখনো কোনো কমিশন নেই।", "Order value": "অর্ডার মূল্য", Rate: "হার", "You earn": "আপনার আয়", Commission: "কমিশন",
  "My orders": "আমার অর্ডার", "No orders yet.": "এখনো কোনো অর্ডার নেই।",
  "Admin access code": "অ্যাডমিন অ্যাক্সেস কোড", "Only for the site owner. One-time code.": "শুধু সাইটের মালিকের জন্য। একবার ব্যবহারযোগ্য কোড।", "Unlock admin": "অ্যাডমিন চালু করুন",
  "That code is not valid or was already used.": "কোডটি সঠিক নয় বা আগেই ব্যবহার হয়েছে।", "You are now an admin ✓ — open the Admin link in the menu.": "আপনি এখন অ্যাডমিন ✓ — মেনু থেকে Admin খুলুন।", "Log out": "লগ আউট",
  // home: manifesto, how it works, cursor labels
  "Our promise": "আমাদের প্রতিশ্রুতি",
  "Finding pure food among so much adulteration is hard. So we bring pure gawa ghee from Kaliganj, Satkhira straight to your home — hold it in your hands first, then pay.": "ভেজালের ভিড়ে খাঁটি খাবার খুঁজে পাওয়া কঠিন। তাই সাতক্ষীরার কালিগঞ্জ থেকে খাঁটি গাওয়া ঘি সরাসরি আপনার ঘরে পৌঁছে দিই — আগে হাতে নিন, তারপর টাকা দিন।",
  "How it works": "কীভাবে কাজ করে", "From Satkhira to your door": "সাতক্ষীরা থেকে আপনার দরজায়", "No risk for you: you pay only when the jar is in your hands.": "আপনার কোনো ঝুঁকি নেই: জার হাতে পাওয়ার পরই টাকা দেবেন।",
  "Order online": "অনলাইনে অর্ডার করুন", "A few taps — nothing to pay in advance.": "কয়েকটি ট্যাপেই — অগ্রিম কিছু দিতে হবে না।",
  "We call you": "আমরা কল করি", "We phone you to confirm your address and delivery.": "ঠিকানা ও ডেলিভারি নিশ্চিত করতে আমরা আপনাকে ফোন করি।",
  "We bring it to your door. No delivery charge.": "আপনার দরজায় পৌঁছে দিই। কোনো ডেলিভারি চার্জ নেই।",
  "Pay on delivery": "হাতে পেয়ে টাকা দিন", "See the product first, then pay in cash.": "আগে পণ্য দেখুন, তারপর ক্যাশে টাকা দিন।",
  "Not happy? Cash refund or a replacement product.": "পছন্দ হয়নি? ক্যাশ রিফান্ড অথবা বদলি পণ্য।",
  Scroll: "স্ক্রল", Enter: "ঢুকুন", Category: "ক্যাটাগরি",
  // courier (Steadfast) on the Track page
  Courier: "কুরিয়ার", "Tracking code": "ট্র্যাকিং কোড", "Live tracking on Steadfast": "Steadfast-এ সরাসরি ট্র্যাক করুন",
  "Parcel booked": "পার্সেল বুক হয়েছে", "On the way": "পথে আছে", "On hold": "আটকে আছে", "Partly delivered": "আংশিক ডেলিভারি", "Returned / cancelled": "ফেরত / বাতিল",
  // order / commission / account statuses (database values)
  pending: "অপেক্ষমাণ", confirmed: "নিশ্চিত", sent_to_supplier: "প্যাক হয়েছে", shipped: "পাঠানো হয়েছে", delivered: "পৌঁছে গেছে", cancelled: "বাতিল",
  payable: "পাওনা", paid: "পরিশোধিত", void: "বাতিল", approved: "অনুমোদিত", rejected: "বাতিল",
};