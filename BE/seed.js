require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

// Import models
const User = require('./src/models/User');
const Role = require('./src/models/Role');
const Category = require('./src/models/Category');
const Size = require('./src/models/Size');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/marc_fashion';

async function seedDatabase() {
  try {
    // Connect to database
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Role.deleteMany({});
    await Category.deleteMany({});
    await Size.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // 1. Create Roles
    const roles = await Role.insertMany([
      {
        name: 'user',
        description: 'Regular customer',
        permissions: ['view_products', 'create_order', 'view_profile'],
        isActive: true
      },
      {
        name: 'admin',
        description: 'Administrator',
        permissions: ['all'],
        isActive: true
      }
    ]);
    console.log('✅ Roles created:', roles.length);

    // 2. Create Sizes
    const sizes = await Size.insertMany([
      { name: 'XS', code: 'XS', isActive: true },
      { name: 'S', code: 'S', isActive: true },
      { name: 'M', code: 'M', isActive: true },
      { name: 'L', code: 'L', isActive: true },
      { name: 'XL', code: 'XL', isActive: true },
      { name: 'XXL', code: 'XXL', isActive: true },
      { name: 'XXXL', code: 'XXXL', isActive: true },
      { name: 'One Size', code: 'ONE_SIZE', isActive: true }
    ]);
    console.log('✅ Sizes created:', sizes.length);

    // 3. Create Categories
    const categories = await Category.insertMany([
      {
        name: 'Áo Kiểu',
        slug: 'ao-kieu',
        description: 'Các kiểu áo thời trang',
        isActive: true
      },
      {
        name: 'Áo Thun',
        slug: 'ao-thun',
        description: 'Áo thun casual',
        isActive: true
      },
      {
        name: 'Quần',
        slug: 'quan',
        description: 'Quần dài, quần ngắn',
        isActive: true
      },
      {
        name: 'Đầm',
        slug: 'dam',
        description: 'Đầm dạo phố, váy đầm',
        isActive: true
      },
      {
        name: 'Váy',
        slug: 'vay',
        description: 'Váy mini, váy chữ A',
        isActive: true
      },
      {
        name: 'Áo Khoác',
        slug: 'ao-khoac',
        description: 'Áo khoác ngoài',
        isActive: true
      }
    ]);
    console.log('✅ Categories created:', categories.length);

    // 4. Create Admin User
    const adminUser = new User({
      fullName: 'Admin Account',
      email: 'admin@marc.com',
      password: 'admin123456',
      phone: '0123456789',
      address: 'Admin Address',
      provider: 'local',
      role: 'admin',
      isActive: true
    });
    await adminUser.save();
    console.log('✅ Admin user created');

    // 5. Create Sample User
    const sampleUser = new User({
      fullName: 'Sample User',
      email: 'user@marc.com',
      password: 'user123456',
      phone: '0987654321',
      address: 'Sample User Address',
      provider: 'local',
      role: 'user',
      isActive: true
    });
    await sampleUser.save();
    console.log('✅ Sample user created');

    // Print success message
    console.log('\n' + '='.repeat(60));
    console.log('✅ DATABASE SEEDING COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('\n📝 Demo Credentials:');
    console.log('\nAdmin Account:');
    console.log('  Email: admin@marc.com');
    console.log('  Password: admin123456');
    console.log('\nRegular User Account:');
    console.log('  Email: user@marc.com');
    console.log('  Password: user123456');
    console.log('\n' + '='.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

// Run seed
seedDatabase();
