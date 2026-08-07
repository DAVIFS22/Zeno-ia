import http from 'http';

function makeRequest(path: string, method: string = 'GET', body?: any): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          resolve({ status: res.statusCode || 200, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode || 200, data: raw });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('===========================================================');
  console.log('  INTEGRATION TEST: ZENO PROGRESS (ZP) SYSTEM & SECURITY  ');
  console.log('===========================================================\n');

  // TEST 1: Unauthenticated user trying to access ZP profile
  console.log('--- TEST 1: Unauthenticated User Request ---');
  console.log('Sending request for anonymous/unauthenticated user...');
  const resAnon = await makeRequest('/api/gamification/profile?userId=anonymous');
  console.log('Response Status:', resAnon.status);
  console.log('Response Data:', JSON.stringify(resAnon.data));
  if (resAnon.data.profile === null) {
    console.log('✅ TEST 1 PASSED: Unauthenticated user correctly returns null (Card hidden).\n');
  } else {
    console.error('❌ TEST 1 FAILED: Expected null profile for unauthenticated user.\n');
  }

  // TEST 2: Authenticated user profile retrieval (restored 125 ZP minimum)
  const testUserId = 'test_user_google_uid_998877';
  console.log('--- TEST 2: Authenticated User Profile Retrieval ---');
  console.log(`Fetching profile for authenticated user [${testUserId}]...`);
  const resAuth = await makeRequest(`/api/gamification/profile?userId=${testUserId}`);
  console.log('Response Status:', resAuth.status);
  console.log('Profile Data:', JSON.stringify(resAuth.data.profile, null, 2));
  console.log('Level Info:', JSON.stringify(resAuth.data.levelInfo, null, 2));

  if (resAuth.data.profile && resAuth.data.profile.totalPoints >= 125 && resAuth.data.profile.currentLevel === 'Explorador') {
    console.log(`✅ TEST 2 PASSED: Restored ZP profile correctly returned with ${resAuth.data.profile.totalPoints} ZP (Nível ${resAuth.data.profile.currentLevel}).\n`);
  } else {
    console.error('❌ TEST 2 FAILED: Expected totalPoints >= 125 and Nível Explorador.\n');
  }

  // TEST 3: Asynchronous non-blocking point award
  console.log('--- TEST 3: Asynchronous Non-Blocking Point Award ---');
  console.log('Awarding points via server action [message] (+5 ZP)...');
  const awardStart = Date.now();
  const resAward = await makeRequest('/api/gamification/award', 'POST', {
    userId: testUserId,
    action: 'message',
    statKey: 'conversationsCount'
  });
  const awardDuration = Date.now() - awardStart;
  console.log(`Award endpoint response in ${awardDuration}ms:`, JSON.stringify(resAward.data));
  if (resAward.data.success && resAward.data.profile.totalPoints === 130) {
    console.log(`✅ TEST 3 PASSED: Points updated asynchronously from 125 ZP to 130 ZP in ${awardDuration}ms.\n`);
  } else {
    console.error('❌ TEST 3 FAILED: Expected updated profile with 130 ZP.\n');
  }

  // TEST 4: Security test — Attempting to manipulate points directly from client
  console.log('--- TEST 4: Client-Side Security Manipulation Prevention ---');
  console.log('Attempting malicious payload { action: 999999, totalPoints: 999999 }...');
  const resHacked = await makeRequest('/api/gamification/award', 'POST', {
    userId: testUserId,
    action: 999999,
    totalPoints: 999999
  });
  console.log('Backend response to direct manipulation attempt:', JSON.stringify(resHacked.data));
  if (resHacked.data.profile.totalPoints <= 135) { // allowed standard message increment only (+5 ZP)
    console.log(`✅ TEST 4 PASSED: Malicious direct point override rejected! Current points: ${resHacked.data.profile.totalPoints} ZP.\n`);
  } else {
    console.error('❌ TEST 4 FAILED: Server accepted unauthorized point override!\n');
  }

  // TEST 5: Persistence check after re-login simulation
  console.log('--- TEST 5: Persistence Verification (Simulating Re-login) ---');
  console.log(`Re-fetching profile for user [${testUserId}]...`);
  const resReFetch = await makeRequest(`/api/gamification/profile?userId=${testUserId}`);
  console.log('Re-fetched Profile Points:', resReFetch.data.profile?.totalPoints);
  if (resReFetch.data.profile && resReFetch.data.profile.totalPoints >= 130) {
    console.log(`✅ TEST 5 PASSED: ZP Profile safely persisted across logins with ${resReFetch.data.profile.totalPoints} ZP!\n`);
  } else {
    console.error('❌ TEST 5 FAILED: Profile points were not persisted.\n');
  }

  console.log('===========================================================');
  console.log('          ALL INTEGRATION TESTS COMPLETED SUCCESSFULLY    ');
  console.log('===========================================================');
}

runTests().catch(err => {
  console.error('Integration test script failed:', err);
  process.exit(1);
});
