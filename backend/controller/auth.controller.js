
const bcrypt = require("bcryptjs");
const userRepository = require("../repositories/user.repository");
const { generateToken } = require("../utilities/generateToken");
const { ApiError } = require("../middleware/error.middleware");

// REGISTRO
const register = async (req, res, next) => {
  try {
    const { nombre, correo, password } = req.body;

    if (
      typeof nombre !== "string" ||
      typeof correo !== "string" ||
      typeof password !== "string" ||
      !nombre.trim() ||
      !correo.trim() ||
      password.length < 6
    ) {
      throw new ApiError(400, "VALIDATION_ERROR", "Name, email, and a six-character password are required");
    }

    const correoNormalizado = correo.trim().toLowerCase();

    const existingUser = await userRepository.searchEmail(correoNormalizado);

    if (existingUser) {
      throw new ApiError(409, "EMAIL_ALREADY_REGISTERED", "Email is already registered");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userId = await userRepository.create(
      nombre.trim(),
      correoNormalizado,
      hashedPassword
    );

    return res.status(201).json({
      mensaje: "Usuario registrado exitosamente",
      usuario: {
        id: userId,
        nombre: nombre.trim(),
        correo: correoNormalizado,
        puntos: 0,
      },
    });

  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT") {
      return next(new ApiError(409, "EMAIL_ALREADY_REGISTERED", "Email is already registered"));
    }
    return next(error);
  }
};

// INICIO DE SESIÓN
const login = async (req, res, next) => {
  try {
    const { correo, password } = req.body;

    if (
      typeof correo !== "string" ||
      typeof password !== "string" ||
      !correo.trim() ||
      !password
    ) {
      throw new ApiError(400, "VALIDATION_ERROR", "Email and password are required");
    }

    const user = await userRepository.searchEmail(
      correo.trim().toLowerCase()
    );

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
    }

    const token = generateToken({ id: user.id });

    return res.status(200).json({
      mensaje: "Inicio de sesión exitoso",
      token,
      usuario: {
        id: user.id,
        nombre: user.nombre,
        correo: user.correo,
        puntos: user.puntos,
      },
    });

  } catch (error) {
    return next(error);
  }
};

const me = async (req, res, next) => {
  try {
    const user = await userRepository.searchId(req.user.id);
    if (!user) throw new ApiError(401, "INVALID_TOKEN", "The access token is invalid");
    return res.status(200).json({ user });
  } catch (error) {
    return next(error);
  }
};

module.exports = { register, login, me };
