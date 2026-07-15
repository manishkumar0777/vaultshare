
async function testMetadata() {
  console.log('🔍 Testing metadata route directly...');

  // First upload a file
  const fileContent = "This is a test file for VaultShare.";
  const file = new File([fileContent], 'test-file.txt', { type: 'text/plain' });

  const formData = new FormData();
  formData.append('file', file);
  formData.append('downloadLimit', '3');
  formData.append('expiresInHours', '24');

  const uploadResponse = await fetch('http://localhost:3000/api/files/simple', {
    method: 'POST',
    body: formData
  });

  if (!uploadResponse.ok) throw new Error('Upload failed');
  const uploadResult = await uploadResponse.json();
  console.log('✅ Upload works');
  console.log('   File ID:', uploadResult.fileId);

  const fileId = uploadResult.fileId;

  // Now test metadata using http module directly
  console.log('\n🔍 Testing metadata with http module...');

  const metaUrl = `http://localhost:3000/api/files/simple/${fileId}/meta`;
  console.log('Fetching:', metaUrl);

  const metaResponse = await fetch(metaUrl);
  console.log('Response status:', metaResponse.status);
  console.log('Response headers:', Object.fromEntries(metaResponse.headers.entries()));

  const metaText = await metaResponse.text();
  console.log('Response text:', metaText);

  if (!metaResponse.ok) {
    throw new Error(`Metadata fetch failed: ${metaResponse.status}`);
  }

  const meta = JSON.parse(metaText);
  console.log('✅ Metadata works!');
  console.log('   Size:', meta.size, 'bytes');
  console.log('   Downloads remaining:', meta.downloadsRemaining);
  console.log('   Is burned:', meta.isBurned);
}

testMetadata().catch(console.error);