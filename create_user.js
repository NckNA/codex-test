const apikey = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const url = "http://127.0.0.1:54321/auth/v1/signup";

fetch(url, {
  method: "POST",
  headers: {
    "apikey": apikey,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ email: "notenant@example.com", password: "password123" })
})
.then(res => res.json())
.then(data => {
  console.log("Signup response:", data);
  const userId = data.user.id;
  console.log("User ID:", userId);
})
.catch(err => console.error(err));
