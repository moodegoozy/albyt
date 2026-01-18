/**
 * Type definitions for the Broast Al-Qaryah application
 * Centralized types to avoid redundant definitions and ensure consistency
 */

/**
 * Menu Item - Product sold by a restaurant
 */
export interface MenuItem {
  id: string;
  name: string;
  desc?: string;
  price: number;
  imageUrl?: string;
  available: boolean;
  categoryId?: string;
  ownerId: string; // Links to restaurants/{ownerId}
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Restaurant - Owner's restaurant profile
 */
export interface Restaurant {
  id: string; // doc ID = ownerId
  name: string;
  ownerId: string;
  email?: string;
  phone?: string;
  city?: string;
  location?: string; // Address or description
  logoUrl?: string;
  // التراخيص
  commercialLicenseUrl?: string; // صورة الرخصة التجارية
  healthCertificateUrl?: string; // صورة الشهادة الصحية
  licenseStatus?: 'pending' | 'approved' | 'rejected'; // حالة مراجعة التراخيص
  licenseNotes?: string; // ملاحظات المراجعة
  referredBy?: string; // UID المشرف الذي أضاف المطعم (admin) - إذا كان فارغ = مسجل من المطور
  referrerType?: 'admin' | 'developer'; // نوع من أضاف المطعم
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Order - Customer purchase record
 */
export interface Order {
  id: string;
  customerId: string; // Links to users/{customerId}
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  address: string;
  deliveryType?: 'delivery' | 'pickup'; // نوع التسليم: توصيل أو استلام من المطعم
  courierId?: string; // Links to users/{courierId} if assigned
  notes?: string;
  restaurantName?: string; // Denormalized for display convenience
  restaurantId?: string; // Links to restaurants/{id}
  // نظام العمولات
  platformFee?: number; // رسوم التطبيق (1.5 ريال لكل طلب)
  adminCommission?: number; // عمولة المشرف (0.5 ريال إذا المطعم مسجل عن طريقه)
  referredBy?: string; // UID المشرف الذي أضاف المطعم
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Order Item - Line item in an order
 */
export interface OrderItem {
  id: string; // menuItems/{id}
  name: string;
  price: number;
  qty: number;
  ownerId?: string; // Restaurant ID for multi-restaurant support
}

/**
 * Order Status - Lifecycle states of an order
 */
export type OrderStatus = 
  | 'pending'           // Just created, awaiting owner acceptance
  | 'accepted'          // Owner accepted the order
  | 'preparing'         // Kitchen is preparing
  | 'ready'             // Ready for pickup/delivery
  | 'out_for_delivery'  // Courier is delivering
  | 'delivered'         // Successfully delivered
  | 'cancelled';        // Order cancelled

/**
 * User - Application user record
 */
export interface User {
  uid: string;
  email: string;
  name?: string;
  role: UserRole;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * User Role - Authorization levels in the app
 */
export type UserRole = 'customer' | 'courier' | 'owner' | 'admin' | 'developer';

/**
 * Admin Role (المشرف):
 * - إضافة/إدارة المطاعم
 * - مراقبة الطلبات للمطاعم المضافة (بدون تعديل)
 * - إدارة المحفظة والمكافآت
 * - يمكنه الطلب كعميل
 */

/**
 * Developer Role (المطور):
 * - جميع الصلاحيات الكاملة
 * - إدارة المستخدمين (إضافة/حذف)
 * - إدارة المطاعم (إضافة/حذف/تعديل)
 * - إدارة الطلبات
 * - إدارة الإعدادات العامة
 */

/**
 * Settings - Global app configuration
 */
export interface AppSettings {
  deliveryFee?: number;
  minOrderAmount?: number;
  operatingHours?: {
    open: string;
    close: string;
  };
  platformFee?: number; // رسوم التطبيق الثابتة (1.5 ريال)
  adminCommissionRate?: number; // نسبة المشرف (0.5 ريال)
  [key: string]: any;
}

/**
 * Wallet - محفظة المشرف أو المطور
 */
export interface Wallet {
  id: string; // = user UID
  balance: number; // الرصيد الحالي
  totalEarnings: number; // إجمالي الأرباح
  totalWithdrawn: number; // إجمالي المسحوب
  transactions: WalletTransaction[];
  updatedAt?: Date;
}

/**
 * WalletTransaction - معاملة في المحفظة
 */
export interface WalletTransaction {
  id: string;
  type: 'credit' | 'debit'; // إيداع أو سحب
  amount: number;
  description: string;
  orderId?: string; // رقم الطلب المرتبط
  restaurantId?: string;
  createdAt: Date;
}
