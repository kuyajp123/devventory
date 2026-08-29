use thiserror::Error;

pub(crate) const MAX_ENV_SOURCE_BYTES: usize = 1_048_576; // 1 MB
pub(crate) const MAX_ENV_LINE_BYTES: usize = 16_384; // 16 KB
pub(crate) const MAX_SECRET_BYTES: usize = 1_048_576; // 1 MB
pub(crate) const MAX_KEY_LENGTH: usize = 255;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ParsedEnvEntry {
    pub(crate) key: String,
    pub(crate) normalized_key: String,
    pub(crate) value: String,
    pub(crate) line_number: u32,
    pub(crate) is_commented: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ParsedEnvFile {
    pub(crate) entries: Vec<ParsedEnvEntry>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Error)]
pub(crate) enum EnvParseErrorCode {
    #[error("The environment source is too large to parse safely.")]
    SourceTooLarge,
    #[error("The environment source is not valid UTF-8 text.")]
    InvalidEncoding,
    #[error("A configuration line is too long to parse safely.")]
    LineTooLong,
    #[error("A configuration assignment could not be parsed.")]
    InvalidAssignment,
    #[error("A configuration key name is not supported.")]
    InvalidKey,
    #[error("Secret value exceeds the 1 MB limit.")]
    ValueTooLarge,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct EnvParseError {
    pub(crate) code: EnvParseErrorCode,
    pub(crate) line_number: Option<u32>,
}

impl std::fmt::Display for EnvParseError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        if let Some(line) = self.line_number {
            write!(formatter, "{} (line {})", self.code, line)
        } else {
            write!(formatter, "{}", self.code)
        }
    }
}

pub(crate) fn parse_env_content(bytes: &[u8]) -> Result<ParsedEnvFile, EnvParseError> {
    if bytes.len() > MAX_ENV_SOURCE_BYTES {
        return Err(EnvParseError {
            code: EnvParseErrorCode::SourceTooLarge,
            line_number: None,
        });
    }

    let source = std::str::from_utf8(bytes).map_err(|_| EnvParseError {
        code: EnvParseErrorCode::InvalidEncoding,
        line_number: None,
    })?;

    let mut entries = Vec::new();
    let raw_lines: Vec<&str> = source.lines().collect();
    let mut line_idx = 0;

    while line_idx < raw_lines.len() {
        let current_line_num = u32::try_from(line_idx + 1).map_err(|_| EnvParseError {
            code: EnvParseErrorCode::LineTooLong,
            line_number: None,
        })?;

        let mut line = raw_lines[line_idx];
        if line_idx == 0 {
            line = line.trim_start_matches('\u{feff}');
        }

        if line.len() > MAX_ENV_LINE_BYTES {
            return Err(EnvParseError {
                code: EnvParseErrorCode::LineTooLong,
                line_number: Some(current_line_num),
            });
        }

        let trimmed = line.trim();
        if trimmed.is_empty() {
            line_idx += 1;
            continue;
        }

        let (assignment, is_commented) = if let Some(comment) = trimmed.strip_prefix('#') {
            let comment_trimmed = comment.trim_start();
            if !comment_trimmed.contains('=') {
                line_idx += 1;
                continue;
            }
            (comment_trimmed, true)
        } else {
            (trimmed, false)
        };

        let Some((raw_key, raw_val_start)) = assignment.split_once('=') else {
            if is_commented {
                line_idx += 1;
                continue;
            }
            return Err(EnvParseError {
                code: EnvParseErrorCode::InvalidAssignment,
                line_number: Some(current_line_num),
            });
        };

        let key = raw_key
            .trim()
            .strip_prefix("export ")
            .unwrap_or(raw_key.trim())
            .trim();

        if !is_valid_env_key(key) {
            return Err(EnvParseError {
                code: EnvParseErrorCode::InvalidKey,
                line_number: Some(current_line_num),
            });
        }

        let val_trimmed_start = raw_val_start.trim_start();

        let (extracted_value, lines_consumed) = if val_trimmed_start.starts_with('"') {
            parse_double_quoted_value(val_trimmed_start, &raw_lines[line_idx..], current_line_num)?
        } else if val_trimmed_start.starts_with('\'') {
            parse_single_quoted_value(val_trimmed_start, &raw_lines[line_idx..], current_line_num)?
        } else {
            (parse_unquoted_value(val_trimmed_start), 1)
        };

        if extracted_value.len() > MAX_SECRET_BYTES {
            return Err(EnvParseError {
                code: EnvParseErrorCode::ValueTooLarge,
                line_number: Some(current_line_num),
            });
        }

        entries.push(ParsedEnvEntry {
            key: key.to_owned(),
            normalized_key: key.to_ascii_uppercase(),
            value: extracted_value,
            line_number: current_line_num,
            is_commented,
        });

        line_idx += lines_consumed;
    }

    Ok(ParsedEnvFile { entries })
}

fn parse_double_quoted_value(
    first_line_val: &str,
    remaining_lines: &[&str],
    start_line_num: u32,
) -> Result<(String, usize), EnvParseError> {
    debug_assert!(first_line_val.starts_with('"'));
    let inner_start = &first_line_val[1..];

    let mut accumulated = String::new();
    let mut in_escape = false;
    let mut closed = false;
    let mut lines_consumed = 1;

    for ch in inner_start.chars() {
        if in_escape {
            match ch {
                'n' => accumulated.push('\n'),
                'r' => accumulated.push('\r'),
                't' => accumulated.push('\t'),
                '"' => accumulated.push('"'),
                '\\' => accumulated.push('\\'),
                '$' => accumulated.push('$'),
                other => {
                    accumulated.push('\\');
                    accumulated.push(other);
                }
            }
            in_escape = false;
        } else if ch == '\\' {
            in_escape = true;
        } else if ch == '"' {
            closed = true;
            break;
        } else {
            accumulated.push(ch);
        }
    }

    if closed {
        return Ok((accumulated, 1));
    }

    for (offset, &raw_line) in remaining_lines.iter().enumerate().skip(1) {
        let line_num = start_line_num + offset as u32;
        if raw_line.len() > MAX_ENV_LINE_BYTES {
            return Err(EnvParseError {
                code: EnvParseErrorCode::LineTooLong,
                line_number: Some(line_num),
            });
        }

        accumulated.push('\n');
        lines_consumed += 1;

        for ch in raw_line.chars() {
            if in_escape {
                match ch {
                    'n' => accumulated.push('\n'),
                    'r' => accumulated.push('\r'),
                    't' => accumulated.push('\t'),
                    '"' => accumulated.push('"'),
                    '\\' => accumulated.push('\\'),
                    '$' => accumulated.push('$'),
                    other => {
                        accumulated.push('\\');
                        accumulated.push(other);
                    }
                }
                in_escape = false;
            } else if ch == '\\' {
                in_escape = true;
            } else if ch == '"' {
                closed = true;
                break;
            } else {
                accumulated.push(ch);
            }
        }

        if closed {
            break;
        }
    }

    Ok((accumulated, lines_consumed))
}

fn parse_single_quoted_value(
    first_line_val: &str,
    remaining_lines: &[&str],
    start_line_num: u32,
) -> Result<(String, usize), EnvParseError> {
    debug_assert!(first_line_val.starts_with('\''));
    let inner_start = &first_line_val[1..];

    if let Some((content, _after)) = inner_start.split_once('\'') {
        return Ok((content.to_string(), 1));
    }

    let mut accumulated = inner_start.to_string();
    let mut lines_consumed = 1;

    for (offset, &raw_line) in remaining_lines.iter().enumerate().skip(1) {
        let line_num = start_line_num + offset as u32;
        if raw_line.len() > MAX_ENV_LINE_BYTES {
            return Err(EnvParseError {
                code: EnvParseErrorCode::LineTooLong,
                line_number: Some(line_num),
            });
        }

        accumulated.push('\n');
        lines_consumed += 1;

        if let Some((content, _after)) = raw_line.split_once('\'') {
            accumulated.push_str(content);
            break;
        } else {
            accumulated.push_str(raw_line);
        }
    }

    Ok((accumulated, lines_consumed))
}

fn parse_unquoted_value(val: &str) -> String {
    let mut result = String::new();
    let mut prev_is_whitespace = false;

    let chars: Vec<char> = val.chars().collect();
    let mut idx = 0;
    while idx < chars.len() {
        let ch = chars[idx];
        if ch == '#' && (idx == 0 || prev_is_whitespace) {
            break;
        }
        result.push(ch);
        prev_is_whitespace = ch.is_whitespace();
        idx += 1;
    }

    result.trim().to_string()
}

fn is_valid_env_key(key: &str) -> bool {
    if key.is_empty() || key.len() > MAX_KEY_LENGTH {
        return false;
    }
    let mut characters = key.chars();
    let Some(first) = characters.next() else {
        return false;
    };
    (first == '_' || first.is_ascii_alphabetic())
        && characters.all(|character| {
            character == '_'
                || character == '-'
                || character == '.'
                || character.is_ascii_alphanumeric()
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_simple_key_values() {
        let content = b"PORT=3000\nDATABASE_URL=postgres://localhost:5432/db\nDEBUG=true";
        let parsed = parse_env_content(content).expect("parse failed");
        assert_eq!(parsed.entries.len(), 3);
        assert_eq!(parsed.entries[0].key, "PORT");
        assert_eq!(parsed.entries[0].value, "3000");
        assert_eq!(parsed.entries[1].key, "DATABASE_URL");
        assert_eq!(parsed.entries[1].value, "postgres://localhost:5432/db");
        assert_eq!(parsed.entries[2].key, "DEBUG");
        assert_eq!(parsed.entries[2].value, "true");
    }

    #[test]
    fn handles_export_prefix_and_quotes() {
        let content = b"export API_KEY=\"secret-123\"\nexport APP_NAME='My Devventory App'\n";
        let parsed = parse_env_content(content).expect("parse failed");
        assert_eq!(parsed.entries.len(), 2);
        assert_eq!(parsed.entries[0].key, "API_KEY");
        assert_eq!(parsed.entries[0].value, "secret-123");
        assert_eq!(parsed.entries[1].key, "APP_NAME");
        assert_eq!(parsed.entries[1].value, "My Devventory App");
    }

    #[test]
    fn parses_escaped_newlines_in_double_quotes() {
        let content = b"CERT=\"line1\\nline2\\nline3\"";
        let parsed = parse_env_content(content).expect("parse failed");
        assert_eq!(parsed.entries[0].value, "line1\nline2\nline3");
    }

    #[test]
    fn parses_multiline_double_quotes() {
        let content =
            b"PRIVATE_KEY=\"-----BEGIN KEY-----\ncontent\n-----END KEY-----\"\nNEXT_VAR=123";
        let parsed = parse_env_content(content).expect("parse failed");
        assert_eq!(parsed.entries.len(), 2);
        assert_eq!(
            parsed.entries[0].value,
            "-----BEGIN KEY-----\ncontent\n-----END KEY-----"
        );
        assert_eq!(parsed.entries[1].key, "NEXT_VAR");
        assert_eq!(parsed.entries[1].value, "123");
    }

    #[test]
    fn handles_comments_and_commented_keys() {
        let content = b"# This is a comment\n# DISABLED_KEY=old_secret\nACTIVE_KEY=new_secret # trailing comment\n";
        let parsed = parse_env_content(content).expect("parse failed");
        assert_eq!(parsed.entries.len(), 2);
        assert_eq!(parsed.entries[0].key, "DISABLED_KEY");
        assert_eq!(parsed.entries[0].value, "old_secret");
        assert!(parsed.entries[0].is_commented);
        assert_eq!(parsed.entries[1].key, "ACTIVE_KEY");
        assert_eq!(parsed.entries[1].value, "new_secret");
        assert!(!parsed.entries[1].is_commented);
    }

    #[test]
    fn rejects_unsupported_encoding() {
        let content = &[0xff, 0xfe, 0x00];
        let err = parse_env_content(content).expect_err("should reject invalid utf-8");
        assert_eq!(err.code, EnvParseErrorCode::InvalidEncoding);
    }
}
