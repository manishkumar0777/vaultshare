// Test MongoDB connection
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://musicflash6_db_user:FL5ksFuLorNdAigA@cluster0.cuwcqws.mongodb.net/vaultshare?retryWrites=true&w=majority';

async function testMongoDB() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected successfully!');

    // Test creating a document
    const TestSchema = new mongoose.Schema({ name: String });
    const TestModel = mongoose.model('Test', TestSchema);

    const testDoc = new TestModel({ name: 'VaultShare Test' });
    await testDoc.save();
    console.log('✅ Test document created');

    // Clean up
    await TestModel.deleteMany({ name: 'VaultShare Test' });
    console.log('✅ Test document cleaned up');

    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error instanceof Error ? error.message : error);
  }
}

testMongoDB();