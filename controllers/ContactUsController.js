const ContactUs = require("../models/ContactUs");

const addContactUs = async (req, res) => {
  try {
    const { name, phone, email, interest, address, experience } = req.body;

    if (!name || !phone || !email) {
      return res.status(400).json({
        message: "Name, phone, and email are required.",
      });
    }

    const newContact = await ContactUs.create({
      name,
      phone,
      email,
      interest,
      address,
      experience,
    });

    return res.status(201).json({
      message: "Contact request submitted successfully.",
      data: newContact,
    });
  } catch (error) {
    console.error("Error in addContactUs:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = { addContactUs }