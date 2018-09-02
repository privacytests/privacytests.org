let secret = "{5865e370-a471-4095-af80-b1ab3571b0a3}"

let tests = {
  "cookie": {
    write: (secret) => {
      let expiry = new Date();
      expiry.setFullYear(expiry.getFullYear() + 1);
      document.cookie = `secret=${secret};expires=${expiry.toUTCString()}`;
    },
    read: () => {
      return document.cookie;
    },
  },
  "localStorage": {
    write: (secret) => {
      localStorage.setItem("secret", secret);
    },
    read: () => {
      return localStorage.getItem("secret");
    }
  },
  "sessionStorage": {
    write: (secret) => {
      sessionStorage.setItem("secret", secret);
    },
    read: () => {
      return sessionStorage.getItem("secret");
    },
  },
  "blob": {
    write: (secret) => {
      return URL.createObjectURL(new Blob([secret]));
    },
    read: async (url) => {
      let response = await fetch(url);
      return response.text();
    },
  },
};
