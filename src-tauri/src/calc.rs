// Pretty Calc — Rust math engine.
// Tokenizer -> shunting-yard (RPN) -> evaluator. Used for committed `=` calls
// where the IPC cost is outweighed by exactness + raw f64 throughput.

use std::f64::consts::{E, PI};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AngleMode {
    Deg,
    Rad,
}

impl AngleMode {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "DEG" | "deg" => Some(AngleMode::Deg),
            "RAD" | "rad" => Some(AngleMode::Rad),
            _ => None,
        }
    }

    pub fn to_rad(self, x: f64) -> f64 {
        match self {
            AngleMode::Deg => x * PI / 180.0,
            AngleMode::Rad => x,
        }
    }

    pub fn from_rad(self, x: f64) -> f64 {
        match self {
            AngleMode::Deg => x * 180.0 / PI,
            AngleMode::Rad => x,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
enum Token {
    Num(f64),
    Op(OpName),
    Func(String),
    ParenOpen,
    ParenClose,
    Postfix(PostfixOp),
    Comma,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum OpName {
    Add,
    Sub,
    Mul,
    Div,
    Pow,
    Mod,
    Neg,
    Implicit,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PostfixOp {
    Fact,
    Percent,
}

impl OpName {
    fn precedence(self) -> u8 {
        match self {
            OpName::Pow | OpName::Neg => 5,
            OpName::Mul | OpName::Div | OpName::Mod | OpName::Implicit => 3,
            OpName::Add | OpName::Sub => 2,
        }
    }

    fn is_right_assoc(self) -> bool {
        matches!(self, OpName::Pow | OpName::Neg)
    }

    fn arity(self) -> usize {
        match self {
            OpName::Neg => 1,
            _ => 2,
        }
    }
}

const FUNCTIONS: &[&str] = &[
    "sin", "cos", "tan", "asin", "acos", "atan",
    "sinh", "cosh", "tanh", "asinh", "acosh", "atanh",
    "ln", "log", "log2", "sqrt", "cbrt", "exp",
    "abs", "floor", "ceil", "round", "sign",
];

fn is_function(name: &str) -> bool {
    FUNCTIONS.contains(&name)
}

fn is_ident_start(c: char) -> bool {
    c.is_ascii_alphabetic() || c == '_'
}

fn is_ident_cont(c: char) -> bool {
    c.is_ascii_alphanumeric() || c == '_'
}

fn is_value_end(t: &Token) -> bool {
    matches!(t, Token::Num(_) | Token::ParenClose | Token::Postfix(_))
}

fn is_value_start(t: &Token) -> bool {
    matches!(t, Token::Num(_) | Token::Func(_) | Token::ParenOpen)
}

fn tokenize(input: &str) -> Result<Vec<Token>, CalcError> {
    let s: String = input.chars().filter(|c| !c.is_whitespace()).collect();
    let bytes: Vec<char> = s.chars().collect();
    let mut tokens: Vec<Token> = Vec::new();
    let mut i = 0;

    macro_rules! push_implicit {
        ($next:expr) => {
            if let Some(last) = tokens.last() {
                if is_value_end(last) && is_value_start(&$next) {
                    tokens.push(Token::Op(OpName::Implicit));
                }
            }
        };
    }

    while i < bytes.len() {
        let c = bytes[i];

        if c.is_ascii_digit() || c == '.' {
            let start = i;
            let mut dot = c == '.';
            i += 1;
            while i < bytes.len() {
                let d = bytes[i];
                if d.is_ascii_digit() {
                    i += 1;
                } else if d == '.' && !dot {
                    dot = true;
                    i += 1;
                } else {
                    break;
                }
            }
            let slice: String = bytes[start..i].iter().collect();
            let num: f64 = slice.parse().map_err(|_| CalcError::new("Malformed number"))?;
            push_implicit!(Token::Num(num));
            tokens.push(Token::Num(num));
            continue;
        }

        if is_ident_start(c) {
            let start = i;
            i += 1;
            while i < bytes.len() && is_ident_cont(bytes[i]) {
                i += 1;
            }
            let name: String = bytes[start..i].iter().collect::<String>().to_lowercase();
            match name.as_str() {
                "pi" => {
                    push_implicit!(Token::Num(PI));
                    tokens.push(Token::Num(PI));
                }
                "e" => {
                    push_implicit!(Token::Num(E));
                    tokens.push(Token::Num(E));
                }
                "ans" => return Err(CalcError::new("ans substituted by caller")),
                "mod" => tokens.push(Token::Op(OpName::Mod)),
                n if is_function(n) => {
                    push_implicit!(Token::Func(n.to_string()));
                    tokens.push(Token::Func(n.to_string()));
                }
                other => return Err(CalcError::new(&format!("Unknown name: {}", other))),
            }
            continue;
        }

        if c == '(' {
            if let Some(last) = tokens.last() {
                if is_value_end(last) {
                    tokens.push(Token::Op(OpName::Implicit));
                }
            }
            tokens.push(Token::ParenOpen);
            i += 1;
            continue;
        }
        if c == ')' {
            tokens.push(Token::ParenClose);
            i += 1;
            continue;
        }
        if c == ',' {
            tokens.push(Token::Comma);
            i += 1;
            continue;
        }
        if c == '!' {
            tokens.push(Token::Postfix(PostfixOp::Fact));
            i += 1;
            continue;
        }
        if c == '%' {
            tokens.push(Token::Postfix(PostfixOp::Percent));
            i += 1;
            continue;
        }
        if c == '+' || c == '-' {
            let is_unary = match tokens.last() {
                None => true,
                Some(t) => matches!(t, Token::Op(_) | Token::Func(_) | Token::Comma | Token::ParenOpen),
            };
            if is_unary {
                if c == '-' {
                    tokens.push(Token::Op(OpName::Neg));
                }
            } else {
                tokens.push(Token::Op(if c == '+' { OpName::Add } else { OpName::Sub }));
            }
            i += 1;
            continue;
        }
        if c == '*' || c == '\u{2217}' || c == '×' || c == '·' {
            tokens.push(Token::Op(OpName::Mul));
            i += 1;
            continue;
        }
        if c == '/' || c == '÷' {
            tokens.push(Token::Op(OpName::Div));
            i += 1;
            continue;
        }
        if c == '^' {
            tokens.push(Token::Op(OpName::Pow));
            i += 1;
            continue;
        }

        return Err(CalcError::new(&format!("Unexpected character: {}", c)));
    }

    Ok(tokens)
}

fn to_rpn(tokens: Vec<Token>) -> Result<Vec<Token>, CalcError> {
    let mut output: Vec<Token> = Vec::new();
    let mut stack: Vec<Token> = Vec::new();

    for t in tokens {
        match &t {
            Token::Num(_) => output.push(t),
            Token::Func(_) => stack.push(t),
            Token::Comma => {
                loop {
                    match stack.last() {
                        Some(Token::ParenOpen) => break,
                        Some(_) => output.push(stack.pop().unwrap()),
                        None => return Err(CalcError::new("Misplaced comma")),
                    }
                }
            }
            Token::Op(op) => {
                let cur = *op;
                while let Some(top) = stack.last() {
                    match top {
                        Token::Func(_) => {
                            output.push(stack.pop().unwrap());
                            continue;
                        }
                        Token::Op(top_op) => {
                            let top_prec = top_op.precedence();
                            let cur_prec = cur.precedence();
                            let right = cur.is_right_assoc();
                            if (right && top_prec > cur_prec) || (!right && top_prec >= cur_prec) {
                                output.push(stack.pop().unwrap());
                                continue;
                            }
                        }
                        _ => {}
                    }
                    break;
                }
                stack.push(Token::Op(cur));
            }
            Token::ParenOpen => stack.push(Token::ParenOpen),
            Token::ParenClose => {
                while let Some(top) = stack.pop() {
                    match top {
                        Token::ParenOpen => break,
                        x => output.push(x),
                    }
                }
                if let Some(Token::Func(_)) = stack.last() {
                    output.push(stack.pop().unwrap());
                }
            }
            Token::Postfix(_) => output.push(t),
        }
    }

    while let Some(t) = stack.pop() {
        if matches!(t, Token::ParenOpen | Token::ParenClose) {
            return Err(CalcError::new("Mismatched parentheses"));
        }
        output.push(t);
    }

    Ok(output)
}

fn factorial(n: f64) -> Result<f64, CalcError> {
    if n < 0.0 || n.fract() != 0.0 {
        return Err(CalcError::new("Factorial requires non-negative integer"));
    }
    if n > 170.0 {
        return Err(CalcError::new("Factorial too large"));
    }
    let mut r = 1.0;
    let k = n as u64;
    for i in 2..=k {
        r *= i as f64;
    }
    Ok(r)
}

fn apply_func(name: &str, x: f64, angle: AngleMode) -> Result<f64, CalcError> {
    let r = match name {
        "sin" => angle.to_rad(x).sin(),
        "cos" => angle.to_rad(x).cos(),
        "tan" => angle.to_rad(x).tan(),
        "asin" => angle.from_rad(x.asin()),
        "acos" => angle.from_rad(x.acos()),
        "atan" => angle.from_rad(x.atan()),
        "sinh" => x.sinh(),
        "cosh" => x.cosh(),
        "tanh" => x.tanh(),
        "asinh" => x.asinh(),
        "acosh" => x.acosh(),
        "atanh" => x.atanh(),
        "ln" => x.ln(),
        "log" => x.log10(),
        "log2" => x.log2(),
        "sqrt" => x.sqrt(),
        "cbrt" => x.cbrt(),
        "exp" => x.exp(),
        "abs" => x.abs(),
        "floor" => x.floor(),
        "ceil" => x.ceil(),
        "round" => x.round(),
        "sign" => x.signum(),
        _ => return Err(CalcError::new(&format!("Unknown function: {}", name))),
    };
    Ok(r)
}

fn evaluate_rpn(rpn: Vec<Token>, angle: AngleMode) -> Result<f64, CalcError> {
    let mut stack: Vec<f64> = Vec::new();

    for t in rpn {
        match t {
            Token::Num(n) => stack.push(n),
            Token::Postfix(op) => {
                let a = stack.pop().ok_or_else(|| CalcError::new("Syntax error"))?;
                let r = match op {
                    PostfixOp::Fact => factorial(a)?,
                    PostfixOp::Percent => a / 100.0,
                };
                stack.push(r);
            }
            Token::Op(op) => {
                let arity = op.arity();
                if arity == 1 {
                    let a = stack.pop().ok_or_else(|| CalcError::new("Syntax error"))?;
                    let r = match op {
                        OpName::Neg => -a,
                        _ => unreachable!("unary arity mismatch"),
                    };
                    stack.push(r);
                } else {
                    let b = stack.pop().ok_or_else(|| CalcError::new("Syntax error"))?;
                    let a = stack.pop().ok_or_else(|| CalcError::new("Syntax error"))?;
                    let r = match op {
                        OpName::Add => a + b,
                        OpName::Sub => a - b,
                        OpName::Mul | OpName::Implicit => a * b,
                        OpName::Div => {
                            if b == 0.0 {
                                return Err(CalcError::new("Division by zero"));
                            }
                            a / b
                        }
                        OpName::Pow => a.powf(b),
                        OpName::Mod => {
                            if b == 0.0 {
                                return Err(CalcError::new("Mod by zero"));
                            }
                            ((a % b) + b) % b
                        }
                        _ => unreachable!("binary arity mismatch"),
                    };
                    stack.push(r);
                }
            }
            Token::Func(name) => {
                let a = stack.pop().ok_or_else(|| CalcError::new(&format!("Missing argument for {}", name)))?;
                stack.push(apply_func(&name, a, angle)?);
            }
            _ => return Err(CalcError::new("Malformed expression")),
        }
    }

    if stack.len() != 1 {
        return Err(CalcError::new(if stack.is_empty() {
            "Empty input"
        } else {
            "Syntax error"
        }));
    }
    Ok(stack.pop().unwrap())
}

#[derive(Debug)]
pub struct CalcError {
    msg: String,
}

impl CalcError {
    pub fn new(msg: &str) -> Self {
        Self { msg: msg.to_string() }
    }
    pub fn message(&self) -> &str {
        &self.msg
    }
}

fn substitute_ans(input: &str, ans: f64) -> String {
    let mut out = String::with_capacity(input.len());
    let chars: Vec<char> = input.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if c.is_ascii_alphabetic() || c == '_' {
            let start = i;
            while i < chars.len() && (chars[i].is_ascii_alphanumeric() || chars[i] == '_') {
                i += 1;
            }
            let word: String = chars[start..i].iter().collect();
            if word.eq_ignore_ascii_case("ans") {
                out.push('(');
                out.push_str(&format_number(ans));
                out.push(')');
            } else {
                out.push_str(&word);
            }
        } else {
            out.push(c);
            i += 1;
        }
    }
    out
}

pub fn format_number(value: f64) -> String {
    if !value.is_finite() || value.is_nan() {
        return "Error".to_string();
    }
    if value == 0.0 {
        return "0".to_string();
    }
    let abs = value.abs();
    if abs >= 1e15 || abs < 1e-9 {
        return format!("{:e}", value);
    }
    let r = format!("{:.12}", value);
    let r = r.trim_end_matches('0').trim_end_matches('.');
    if r.is_empty() || r == "-" {
        "0".to_string()
    } else {
        r.to_string()
    }
}

pub fn evaluate(input: &str, angle: AngleMode, ans: f64) -> Result<f64, CalcError> {
    let with_ans = substitute_ans(input, ans);
    let trimmed = with_ans.trim();
    if trimmed.is_empty() {
        return Err(CalcError::new("Empty input"));
    }
    let tokens = tokenize(trimmed)?;
    let rpn = to_rpn(tokens)?;
    evaluate_rpn(rpn, angle)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn eval(s: &str) -> f64 {
        evaluate(s, AngleMode::Deg, 0.0).unwrap()
    }

    #[test]
    fn basic() {
        assert!((eval("1+2") - 3.0).abs() < 1e-12);
        assert!((eval("2*3+4") - 10.0).abs() < 1e-12);
        assert!((eval("2+3*4") - 14.0).abs() < 1e-12);
        assert!((eval("(2+3)*4") - 20.0).abs() < 1e-12);
        assert!((eval("2^3") - 8.0).abs() < 1e-12);
        assert!((eval("10/2/5") - 1.0).abs() < 1e-12);
    }

    #[test]
    fn unary_and_implicit() {
        assert!((eval("-2+3") - 1.0).abs() < 1e-12);
        assert!((eval("2(3)") - 6.0).abs() < 1e-12);
        assert!((eval("2pi") - 2.0 * PI).abs() < 1e-12);
    }

    #[test]
    fn funcs() {
        assert!((eval("sqrt(16)") - 4.0).abs() < 1e-12);
        assert!((eval("sin(30)") - 0.5).abs() < 1e-12);
        assert!((eval("ln(e)") - 1.0).abs() < 1e-12);
        assert!((eval("log(100)") - 2.0).abs() < 1e-12);
        assert!((eval("5!") - 120.0).abs() < 1e-9);
        assert!((eval("50%") - 0.5).abs() < 1e-12);
    }
}