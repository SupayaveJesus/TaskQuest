const bcrypt = require("bcryptjs");
const userRepository = require("../repositories/user.repository");
const { generateToken } = require("../utilities/generateToken");
const { ApiError } = require("../middleware/error.middleware");

const normalizeEmail = (email) => email.trim().toLowerCase();

const toPublicUser = (user) => ({
  id: user.id,
  nombre: user.nombre,
  correo: user.correo,
  puntos: user.puntos,
});

const register = async (req, res, next) => {
  try {
    const { nombre, correo, password } = req.body;

    const isInvalidData =
      typeof nombre !== "string" ||
      typeof correo !== "string" ||
      typeof password !== "string" ||
      !nombre.trim() ||
      !correo.trim() ||
      password.length < 6;

    if (isInvalidData) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Name, email, and a six-character password are required",
      );
    }

    const normalizedEmail = normalizeEmail(correo);

    const existingUser = await userRepository.findByEmail(normalizedEmail);

    if (existingUser) {
      throw new ApiError(
        409,
        "EMAIL_ALREADY_REGISTERED",
        "Email is already registered",
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userId = await userRepository.create({
      nombre: nombre.trim(),
      correo: normalizedEmail,
      password: hashedPassword,
    });

    return res.status(201).json({
      mensaje: "Usuario registrado exitosamente",
      usuario: toPublicUser({
        id: userId,
        nombre: nombre.trim(),
        correo: normalizedEmail,
        puntos: 0,
      }),
    });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT") {
      return next(
        new ApiError(
          409,
          "EMAIL_ALREADY_REGISTERED",
          "Email is already registered",
        ),
      );
    }
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { correo, password } = req.body;
    const isInvalidLoginData =
      typeof correo !== "string" ||
      typeof password !== "string" ||
      !correo.trim() ||
      !password;

    if (isInvalidLoginData) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Email and password are required",
      );
    }

    const user = await userRepository.findByEmail(normalizeEmail(correo));

    const isInvalidCredentials =
      !user || !(await bcrypt.compare(password, user.password));

    if (isInvalidCredentials) {
      throw new ApiError(
        401,
        "INVALID_CREDENTIALS",
        "Email or password is incorrect",
      );
    }

    const token = generateToken({ id: user.id });

    return res.status(200).json({
      mensaje: "Inicio de sesión exitoso",
      token,
      usuario: toPublicUser(user),
    });
  } catch (error) {
    return next(error);
  }
};

const me = async (req, res, next) => {
  try {
    const user = await userRepository.findById(req.user.id);

    if (!user) {
      throw new ApiError(401, "INVALID_TOKEN", "The access token is invalid");
    }

    return res.status(200).json({
      user: toPublicUser(user),
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  register,
  login,
  me,
};
