async function testAllRoutes() {
  console.log('🧪 Testing all routes...\n');

  try {
    // 1. Upload a file
    console.log('1. Testing upload...');
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
    console.log('   ✅ Upload works');
    console.log('   File ID:', uploadResult.fileId);
    console.log('   Share URL:', uploadResult.shareUrl);

    const fileId = uploadResult.fileId;

    // 2. Test metadata
    console.log('\n2. Testing metadata...');
    const metaResponse = await fetch(`http://localhost:3000/api/files/simple/${fileId}/meta`);
    if (!metaResponse.ok) throw new Error('Metadata fetch failed');
    const meta = await metaResponse.json();
    console.log('   ✅ Metadata works');
    console.log('   Size:', meta.size, 'bytes');
    console.log('   Downloads remaining:', meta.downloadsRemaining);
    console.log('   Is burned:', meta.isBurned);

    // 3. Test file list
    console.log('\n3. Testing file list...');
    const listResponse = await fetch('http://localhost:3000/api/files/list');
    if (!listResponse.ok) throw new Error('File list failed');
    const listResult = await listResponse.json();
    console.log('   ✅ File list works');
    console.log('   Files:', listResult.files.length);

    // 4. Test download
    console.log('\n4. Testing download...');
    const downloadResponse = await fetch(`http://localhost:3000/api/files/simple/${fileId}`);
    if (!downloadResponse.ok) throw new Error('Download failed');

    const ivBase64 = downloadResponse.headers.get('X-File-IV');
    console.log('   ✅ Download works');
    console.log('   IV header:', ivBase64 ? 'present' : 'missing');

    const encryptedData = await downloadResponse.arrayBuffer();
    console.log('   Encrypted data size:', encryptedData.byteLength, 'bytes');

    // 5. Test second download (should work since limit is 3)
    console.log('\n5. Testing second download...');
    const secondDownloadResponse = await fetch(`http://localhost:3000/api/files/simple/${fileId}`);
    if (!secondDownloadResponse.ok) throw new Error('Second download failed');
    console.log('   ✅ Second download works (limit not reached)');

    // 6. Test metadata again to verify downloads remaining
    console.log('\n6. Testing metadata after downloads...');
    const metaResponse2 = await fetch(`http://localhost:3000/api/files/simple/${fileId}/meta`);
    if (!metaResponse2.ok) throw new Error('Metadata fetch failed');
    const meta2 = await metaResponse2.json();
    console.log('   ✅ Metadata after downloads works');
    console.log('   Downloads remaining:', meta2.downloadsRemaining);

    console.log('\n🎉 ALL ROUTES WORKING PERFECTLY!');
    return true;
  } catch (error) {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

testAllRoutes().then(success => {
  process.exit(success ? 0 : 1);
});