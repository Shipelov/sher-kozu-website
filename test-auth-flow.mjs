// Test the full login + auth.me flow
const BASE = 'http://localhost:3000';

// Step 1: Login
console.log('--- Step 1: Login ---');
const loginRes = await fetch(`${BASE}/api/trpc/localAuth.login?batch=1`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({"0":{"json":{"email":"test.admin@sherkozu.ru","password":"SherKozu2025!","rememberMe":false}}}),
  redirect: 'manual',
});

console.log('Login status:', loginRes.status);
const setCookies = loginRes.headers.getSetCookie?.() || [];
console.log('Set-Cookie headers:', setCookies);
const loginBody = await loginRes.json();
console.log('Login response:', JSON.stringify(loginBody));

// Extract cookie
const sessionCookie = setCookies.find(c => c.startsWith('app_session_id='));
if (!sessionCookie) {
  console.log('No session cookie set! Trying with different password...');
  
  // Try another password
  const loginRes2 = await fetch(`${BASE}/api/trpc/localAuth.login?batch=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({"0":{"json":{"email":"rusventure@gmail.com","password":"test","rememberMe":false}}}),
    redirect: 'manual',
  });
  console.log('Login2 status:', loginRes2.status);
  const body2 = await loginRes2.json();
  console.log('Login2 response:', JSON.stringify(body2));
} else {
  // Step 2: Call auth.me with the cookie
  console.log('\n--- Step 2: auth.me ---');
  const cookieValue = sessionCookie.split(';')[0];
  const meRes = await fetch(`${BASE}/api/trpc/auth.me?batch=1&input=%7B%220%22%3A%7B%7D%7D`, {
    headers: { 'Cookie': cookieValue },
  });
  console.log('auth.me status:', meRes.status);
  const meBody = await meRes.json();
  console.log('auth.me response:', JSON.stringify(meBody, null, 2));
}
