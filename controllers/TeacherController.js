const bcrypt = require("bcryptjs");
const Teacher = require("../models/Teacher");
const User = require("../models/User");
const Class = require("../models/Class");
const Student = require("../models/Student");
const Assignment = require("../models/Assignment");
const Timetable = require("../models/TimeTable");
const Admin = require("../models/Admin");

const mongoose = require("mongoose");
const { sendWelcomeEmail } = require("../services/emailServices");

const createTeacher = async (req, res) => {
  try {
    const { adminId,branch } = req.body;

    if (!adminId || !branch) {
      return res.status(400).json({
        success: false,
        message: "Admin ID is required",
      });
    }

    const adminExists = await Admin.findById(adminId);
    if (!adminExists) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    const {
      fullName,
      gender,
      dateOfBirth,
      address,
      phone,
      email,
      password,
      qualification,
      specialization,
      experienceYears,
      hireDate,
      assignedClasses = [],
      subjects = [],
      languages = [],
      status = "Active",
    } = req.body;

    const requiredFields = ["fullName", "email", "password", "phone"];
    const missingFields = requiredFields.filter((field) => !req.body[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      password: hashedPassword,
      role: "Teacher",
      createdBy: adminId,
    });

    const teacher = await Teacher.create({
      user: user._id,
      fullName,
      gender,
      dateOfBirth,
      address,
      phone,
      email,
      password: hashedPassword,
      qualification,
      specialization,
      experienceYears,
      hireDate: hireDate || Date.now(),
      assignedClasses,
      subjects,
      languages,
      status,
      createdBy: adminId,
      branch
    });

    user.teacher = teacher._id;
    await user.save();

    await sendWelcomeEmail({
      email: email,
      role: "Teacher",
    });

    return res.status(201).json({
      success: true,
      message: "Teacher created successfully",
      data: {
        teacher: {
          ...teacher._doc,
          password: undefined,
        },
        user: {
          ...user._doc,
          password: undefined,
        },
      },
    });
  } catch (error) {
    console.error("❌ createTeacher error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: Object.values(error.errors).map((err) => err.message),
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const getAllTeachers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      status,
      search,
      sortBy = "fullName",
      sortOrder = "asc",
      adminId,
    } = req.body;

    if (!adminId) {
      return res.status(400).json({
        success: false,
        message: "Admin ID is required",
      });
    }

    const filter = {
      createdBy: adminId,
    };

    if (status && status !== "all") {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { qualification: { $regex: search, $options: "i" } },
        { specialization: { $regex: search, $options: "i" } },
        { address: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === "desc" ? -1 : 1;

    const teachers = await Teacher.find(filter)
      .populate("user", "email role status")
      .populate("assignedClasses", "className section gradeLevel")
      .select("-password")
      .sort(sortConfig)
      .skip(skip)
      .limit(limit)
      .lean();

    const totalTeachers = await Teacher.countDocuments(filter);
    const totalPages = Math.ceil(totalTeachers / limit);

    return res.status(200).json({
      success: true,
      message: "Teachers fetched successfully.",
      data: teachers,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalTeachers,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("❌ Error fetching teachers:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getTeacherById = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        message: "Teacher ID is required.",
      });
    }

    const teacher = await Teacher.findById(id)
      .populate("user", "email role status")
      .populate("assignedClasses", "className section gradeLevel")
      .populate("subjects")
      .select("-password");

    if (!teacher) {
      return res.status(404).json({
        message: "Teacher not found.",
      });
    }

    return res.status(200).json({
      message: "Teacher fetched successfully.",
      teacher,
    });
  } catch (error) {
    console.error("❌ Error fetching teacher:", error);
    return res.status(500).json({ message: error.message });
  }
};

const updateTeacher = async (req, res) => {
  try {
    const {
      id,
      fullName,
      gender,
      dateOfBirth,
      address,
      phone,
      qualification,
      specialization,
      experienceYears,
      hireDate,
      assignedClasses,
      subjects,
      languages,
      status,
    } = req.body;

    if (!id) {
      return res.status(400).json({
        message: "Teacher ID is required.",
      });
    }

    const updateData = {
      ...(fullName && { fullName }),
      ...(gender && { gender }),
      ...(dateOfBirth && { dateOfBirth }),
      ...(address && { address }),
      ...(phone && { phone }),
      ...(qualification && { qualification }),
      ...(specialization && { specialization }),
      ...(experienceYears && { experienceYears }),
      ...(hireDate && { hireDate }),
      ...(assignedClasses && { assignedClasses }),
      ...(subjects && { subjects }),
      ...(languages && { languages }),
      ...(status && { status }),
    };

    const teacher = await Teacher.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-password");

    if (!teacher) {
      return res.status(404).json({
        message: "Teacher not found.",
      });
    }

    return res.status(200).json({
      message: "Teacher updated successfully.",
      teacher,
    });
  } catch (error) {
    console.error("❌ Error updating teacher:", error);
    return res.status(500).json({ message: error.message });
  }
};

const deleteTeacher = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        message: "Teacher ID is required.",
      });
    }

    const teacher = await Teacher.findById(id);
    if (!teacher) {
      return res.status(404).json({
        message: "Teacher not found.",
      });
    }

    await User.findByIdAndDelete(teacher.user);
    await Teacher.findByIdAndDelete(id);

    return res.status(200).json({
      message: "Teacher deleted successfully.",
    });
  } catch (error) {
    console.error("❌ Error deleting teacher:", error);
    return res.status(500).json({ message: error.message });
  }
};

const getTeachersName = async (req, res) => {
  try {
    const { adminId } = req.body;

    if (!adminId) {
      return res.status(400).json({
        success: false,
        message: "Admin ID is required",
      });
    }

    const teachers = await Teacher.find(
      { createdBy: adminId },
      {
        _id: 1,
        specialization: 1,
        fullName: 1,
        status: 1,
      }
    ).lean();

    return res.status(200).json({
      success: true,
      message: "Teacher names and specializations fetched successfully.",
      data: teachers,
    });
  } catch (error) {
    console.error("❌ Error fetching teacher names:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getTeacherDetail = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Teacher ID is required." });
    }

    const teacherDetail = await Teacher.aggregate([
      {
        $match: { _id: new mongoose.Types.ObjectId(id) },
      },
      {
        $lookup: {
          from: "classes",
          localField: "assignedClasses",
          foreignField: "_id",
          as: "assignedClasses",
        },
      },
      // Lookup students for each class
      {
        $unwind: {
          path: "$assignedClasses",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "students",
          let: { classId: "$assignedClasses._id" },
          pipeline: [
            {
              $match: {
                $expr: { $in: ["$$classId", "$classes"] },
              },
            },
            {
              $project: {
                studentName: 1,
                email: 1,
                phone: 1,
                address: 1,
              },
            },
          ],
          as: "assignedClasses.students",
        },
      },
      {
        $group: {
          _id: "$_id",
          name: { $first: "$name" },
          email: { $first: "$email" },
          // any other teacher fields
          assignedClasses: { $push: "$assignedClasses" },
        },
      },
      {
        $project: { password: 0 }, // remove password
      },
    ]);

    if (!teacherDetail.length) {
      return res.status(404).json({ message: "Teacher not found." });
    }

    return res.status(200).json({
      message: "Teacher detail fetched successfully.",
      teacher: teacherDetail[0],
    });
  } catch (error) {
    console.error("❌ Error fetching teacher detail:", error);
    return res.status(500).json({ message: error.message });
  }
};

const getTeacherDashboardStat = async (req, res) => {
  try {
    const { teacherId } = req.body;

    const teacher = await Teacher.findById(teacherId)
      .populate("assignedClasses")
      .populate("timetable");

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const currentDate = new Date();
    const startOfToday = new Date(currentDate.setHours(0, 0, 0, 0));
    const endOfToday = new Date(currentDate.setHours(23, 59, 59, 999));

    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const activeClassesCount = await Class.countDocuments({
      teacherId: teacherId,
      isActive: true,
    });

    const totalStudents = await Student.countDocuments({
      classes: { $in: teacher.assignedClasses },
    });

    const assignmentsDueCount = await Assignment.countDocuments({
      teacher: teacherId,
      dueDate: {
        $gte: startOfWeek,
        $lte: endOfWeek,
      },
    });

    const daysOfWeek = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const today = daysOfWeek[currentDate.getDay()];

    const upcomingLessons = await Timetable.find({
      teacher: teacherId,
      dayOfWeek: today,
    })
      .populate("class", "name subject")
      .sort({ startTime: 1 });

    const formattedLessons = upcomingLessons.map((lesson) => ({
      time: formatTime(lesson.startTime),
      title: lesson.subject,
      className: lesson.class.name,
      focus: lesson.topic || `${lesson.subject} discussion`,
    }));

    const assessments = await Assignment.find({
      teacher: teacherId,
      dueDate: { $gte: startOfToday },
    })
      .populate("class", "name")
      .sort({ dueDate: 1 })
      .limit(5);

    const formattedAssessments = await Promise.all(
      assessments.map(async (assessment) => {
        const submissionCount = assessment.solutions.length;
        const totalStudentsInClass = await Student.countDocuments({
          classes: assessment.class._id,
        });

        return {
          title: assessment.title,
          className: assessment.class.name,
          due: formatDueDate(assessment.dueDate),
          submissions: `${submissionCount}/${totalStudentsInClass}`,
          status: getAssessmentStatus(
            assessment,
            submissionCount,
            totalStudentsInClass
          ),
        };
      })
    );

    const studentFocus = await Student.aggregate([
      {
        $match: {
          classes: { $in: teacher.assignedClasses.map((c) => c._id) },
        },
      },
      {
        $lookup: {
          from: "assignments",
          localField: "_id",
          foreignField: "student",
          as: "submissions",
        },
      },
      {
        $lookup: {
          from: "attendances",
          localField: "_id",
          foreignField: "student",
          as: "attendance",
        },
      },
      {
        $addFields: {
          missingAssignments: {
            $size: {
              $filter: {
                input: "$submissions",
                as: "sub",
                cond: { $eq: ["$$sub.submitted", false] },
              },
            },
          },
          recentAbsences: {
            $size: {
              $filter: {
                input: "$attendance",
                as: "att",
                cond: {
                  $and: [
                    { $eq: ["$$att.status", "Absent"] },
                    { $gte: ["$$att.date", startOfWeek] },
                  ],
                },
              },
            },
          },
        },
      },
      {
        $match: {
          $or: [
            { missingAssignments: { $gt: 0 } },
            { recentAbsences: { $gt: 1 } },
          ],
        },
      },
      {
        $limit: 3,
      },
    ]);

    const studentFocusWithClasses = await Promise.all(
      studentFocus.map(async (student) => {
        const primaryClass = await getStudentPrimaryClass(student._id);
        return {
          ...student,
          primaryClass,
        };
      })
    );

    const formattedStudentFocus = studentFocusWithClasses.map((student) => ({
      name: student.studentName,
      className: student.primaryClass,
      status: getStudentStatus(student),
    }));

    const dashboardData = {
      stats: [
        {
          label: "Active Classes",
          value: activeClassesCount,
          sublabel: "This semester",
          icon: "BookOpen",
        },
        {
          label: "Total Students",
          value: totalStudents,
          sublabel: "Across classes",
          icon: "Users",
        },
        {
          label: "Assignments Due",
          value: assignmentsDueCount,
          sublabel: "This week",
          icon: "ClipboardList",
        },
      ],
      upcomingLessons: formattedLessons,
      assessments: formattedAssessments,
      studentFocus: formattedStudentFocus,
    };

    res.status(200).json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard data",
      error: error.message,
    });
  }
};

function formatTime(timeString) {
  const [hours, minutes] = timeString.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const formattedHour = hour % 12 || 12;
  return `${formattedHour}:${minutes} ${ampm}`;
}

function formatDueDate(dueDate) {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (dueDate.toDateString() === now.toDateString()) {
    return "Today";
  } else if (dueDate.toDateString() === tomorrow.toDateString()) {
    return "Tomorrow";
  } else {
    return dueDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }
}

function getAssessmentStatus(assessment, submissionCount, totalStudents) {
  if (submissionCount === 0) return "Scheduled";
  if (submissionCount === totalStudents) return "Completed";
  if (submissionCount > 0) return "In Progress";
  return "Not Started";
}

async function getStudentPrimaryClass(studentId) {
  const student = await Student.findById(studentId).populate("classes");
  return student.classes.length > 0 ? student.classes[0].name : "No Class";
}

function getStudentStatus(student) {
  if (student.recentAbsences > 1) {
    return `Absent ${student.recentAbsences} times this week`;
  }
  if (student.missingAssignments > 0) {
    return `${student.missingAssignments} assignment(s) missing`;
  }
  return "Needs attention";
}

module.exports = {
  createTeacher,
  getAllTeachers,
  getTeacherById,
  updateTeacher,
  deleteTeacher,
  getTeachersName,
  getTeacherDetail,
  getTeacherDashboardStat,
};
