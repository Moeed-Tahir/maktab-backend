const bcrypt = require("bcryptjs");
const Teacher = require("../models/Teacher");
const User = require("../models/User");
const Class = require("../models/Class");
const Student = require("../models/Student");
const Assignment = require("../models/Assignment");
const Timetable  = require("../models/TimeTable");

const mongoose = require("mongoose");

const createTeacher = async (req, res) => {
  try {
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
      assignedClasses,
      subjects,
      languages,
    } = req.body;

    if (!fullName || !email || !password || !phone) {
      return res.status(400).json({
        message: "Full name, email, password, and phone are required.",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: "User with this email already exists."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      password: hashedPassword,
      role: "Teacher",
    });

    const teacher = new Teacher({
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
      hireDate,
      assignedClasses: assignedClasses || [],
      subjects: subjects || [],
      languages: languages || [],
    });

    await teacher.save();

    return res.status(201).json({
      message: "Teacher created successfully.",
      teacher,
      user,
    });
  } catch (error) {
    console.error("❌ Error creating teacher:", error);
    return res.status(500).json({ message: error.message });
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
      sortOrder = "asc"
    } = req.body;

    const filter = {};

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { qualification: { $regex: search, $options: 'i' } },
        { specialization: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const teachers = await Teacher.find(filter)
      .populate('user', 'email role status')
      .populate('assignedClasses', 'className section gradeLevel')
      .select('-password')
      .sort(sortConfig)
      .skip(skip)
      .limit(limit)
      .lean();

    const totalTeachers = await Teacher.countDocuments(filter);
    const totalPages = Math.ceil(totalTeachers / limit);

    return res.status(200).json({
      message: "Teachers fetched successfully.",
      teachers,
      pagination: {
        currentPage: page,
        totalPages,
        totalTeachers,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching teachers:", error);
    return res.status(500).json({ message: error.message });
  }
};

const getTeacherById = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        message: "Teacher ID is required."
      });
    }

    const teacher = await Teacher.findById(id)
      .populate('user', 'email role status')
      .populate('assignedClasses', 'className section gradeLevel')
      .populate('subjects')
      .select('-password');

    if (!teacher) {
      return res.status(404).json({
        message: "Teacher not found."
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
      status
    } = req.body;

    if (!id) {
      return res.status(400).json({
        message: "Teacher ID is required."
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
    ).select('-password');

    if (!teacher) {
      return res.status(404).json({
        message: "Teacher not found."
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
        message: "Teacher ID is required."
      });
    }

    const teacher = await Teacher.findById(id);
    if (!teacher) {
      return res.status(404).json({
        message: "Teacher not found."
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
    const teachers = await Teacher.find({}, {
      _id: 1,
      specialization: 1,
      fullName: 1
    }).lean();

    return res.status(200).json({
      message: "Teacher names and specializations fetched successfully.",
      teachers,
    });
  } catch (error) {
    console.error("❌ Error fetching teacher names:", error);
    return res.status(500).json({ message: error.message });
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
        $match: { _id: new mongoose.Types.ObjectId(id) }
      },
      {
        $lookup: {
          from: "classes",
          localField: "assignedClasses",
          foreignField: "_id",
          as: "assignedClasses"
        }
      },
      // Lookup students for each class
      {
        $unwind: {
          path: "$assignedClasses",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: "students",
          let: { classId: "$assignedClasses._id" },
          pipeline: [
            {
              $match: {
                $expr: { $in: ["$$classId", "$classes"] }
              }
            },
            {
              $project: {
                studentName: 1,
                email: 1,
                phone: 1,
                address: 1
              }
            }
          ],
          as: "assignedClasses.students"
        }
      },
      {
        $group: {
          _id: "$_id",
          name: { $first: "$name" },
          email: { $first: "$email" },
          // any other teacher fields
          assignedClasses: { $push: "$assignedClasses" }
        }
      },
      {
        $project: { password: 0 } // remove password
      }
    ]);

    if (!teacherDetail.length) {
      return res.status(404).json({ message: "Teacher not found." });
    }

    return res.status(200).json({
      message: "Teacher detail fetched successfully.",
      teacher: teacherDetail[0]
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
      .populate('assignedClasses')
      .populate('timetable');

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
      isActive: true
    });

    const totalStudents = await Student.countDocuments({
      classes: { $in: teacher.assignedClasses }
    });

    const assignmentsDueCount = await Assignment.countDocuments({
      teacher: teacherId,
      dueDate: {
        $gte: startOfWeek,
        $lte: endOfWeek
      }
    });

    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const today = daysOfWeek[currentDate.getDay()];

    const upcomingLessons = await Timetable.find({
      teacher: teacherId,
      dayOfWeek: today
    })
      .populate('class', 'name subject')
      .sort({ startTime: 1 });

    const formattedLessons = upcomingLessons.map(lesson => ({
      time: formatTime(lesson.startTime),
      title: lesson.subject,
      className: lesson.class.name,
      focus: lesson.topic || `${lesson.subject} discussion`
    }));

    const assessments = await Assignment.find({
      teacher: teacherId,
      dueDate: { $gte: startOfToday }
    })
      .populate('class', 'name')
      .sort({ dueDate: 1 })
      .limit(5);

    const formattedAssessments = await Promise.all(
      assessments.map(async (assessment) => {
        const submissionCount = assessment.solutions.length;
        const totalStudentsInClass = await Student.countDocuments({
          classes: assessment.class._id
        });

        return {
          title: assessment.title,
          className: assessment.class.name,
          due: formatDueDate(assessment.dueDate),
          submissions: `${submissionCount}/${totalStudentsInClass}`,
          status: getAssessmentStatus(assessment, submissionCount, totalStudentsInClass)
        };
      })
    );

    const studentFocus = await Student.aggregate([
      {
        $match: {
          classes: { $in: teacher.assignedClasses.map(c => c._id) }
        }
      },
      {
        $lookup: {
          from: 'assignments',
          localField: '_id',
          foreignField: 'student',
          as: 'submissions'
        }
      },
      {
        $lookup: {
          from: 'attendances',
          localField: '_id',
          foreignField: 'student',
          as: 'attendance'
        }
      },
      {
        $addFields: {
          missingAssignments: {
            $size: {
              $filter: {
                input: '$submissions',
                as: 'sub',
                cond: { $eq: ['$$sub.submitted', false] }
              }
            }
          },
          recentAbsences: {
            $size: {
              $filter: {
                input: '$attendance',
                as: 'att',
                cond: {
                  $and: [
                    { $eq: ['$$att.status', 'Absent'] },
                    { $gte: ['$$att.date', startOfWeek] }
                  ]
                }
              }
            }
          }
        }
      },
      {
        $match: {
          $or: [
            { missingAssignments: { $gt: 0 } },
            { recentAbsences: { $gt: 1 } }
          ]
        }
      },
      {
        $limit: 3
      }
    ]);

    const studentFocusWithClasses = await Promise.all(
      studentFocus.map(async (student) => {
        const primaryClass = await getStudentPrimaryClass(student._id);
        return {
          ...student,
          primaryClass
        };
      })
    );

    const formattedStudentFocus = studentFocusWithClasses.map(student => ({
      name: student.studentName,
      className: student.primaryClass,
      status: getStudentStatus(student)
    }));

    const dashboardData = {
      stats: [
        {
          label: "Active Classes",
          value: activeClassesCount,
          sublabel: "This semester",
          icon: "BookOpen"
        },
        {
          label: "Total Students",
          value: totalStudents,
          sublabel: "Across classes",
          icon: "Users"
        },
        {
          label: "Assignments Due",
          value: assignmentsDueCount,
          sublabel: "This week",
          icon: "ClipboardList"
        }
      ],
      upcomingLessons: formattedLessons,
      assessments: formattedAssessments,
      studentFocus: formattedStudentFocus
    };

    res.status(200).json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard data",
      error: error.message
    });
  }
};

function formatTime(timeString) {
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
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
    return dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

function getAssessmentStatus(assessment, submissionCount, totalStudents) {
  if (submissionCount === 0) return "Scheduled";
  if (submissionCount === totalStudents) return "Completed";
  if (submissionCount > 0) return "In Progress";
  return "Not Started";
}

async function getStudentPrimaryClass(studentId) {
  const student = await Student.findById(studentId).populate('classes');
  return student.classes.length > 0 ? student.classes[0].name : 'No Class';
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
  getTeacherDashboardStat
};