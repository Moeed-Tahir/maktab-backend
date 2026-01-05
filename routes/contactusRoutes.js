const express = require("express");
const router = express.Router();
const { addContactUs } = require("../controllers/ContactUsController");

router.post("/addContactUs", addContactUs);

module.exports = router;
