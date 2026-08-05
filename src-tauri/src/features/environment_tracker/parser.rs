pub(super) const MAX_ENVIRONMENT_SOURCE_BYTES: usize = 1_048_576;
const MAX_ENVIRONMENT_SOURCE_LINE_BYTES: usize = 16_384;

#[derive(Debug, PartialEq, Eq)]
pub(crate) struct ParsedKeyOccurrence {
    pub(super) name: String,
    pub(super) normalized_name: String,
    pub(super) line_number: u32,
    pub(super) is_commented: bool,
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) struct ParsedEnvironmentSource {
    pub(super) occurrences: Vec<ParsedKeyOccurrence>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum SafeParseIssueCode {
    InvalidAssignment,
    InvalidEncoding,
    InvalidKey,
    LineTooLong,
    SourceTooLarge,
}

impl SafeParseIssueCode {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::InvalidAssignment => "invalid_assignment",
            Self::InvalidEncoding => "invalid_encoding",
            Self::InvalidKey => "invalid_key",
            Self::LineTooLong => "line_too_long",
            Self::SourceTooLarge => "source_too_large",
        }
    }

    pub(crate) fn safe_message(self) -> &'static str {
        match self {
            Self::InvalidAssignment => "A configuration assignment could not be parsed.",
            Self::InvalidEncoding => "The configuration source is not valid UTF-8 text.",
            Self::InvalidKey => "A configuration key name is not supported.",
            Self::LineTooLong => "A configuration line is too long to parse safely.",
            Self::SourceTooLarge => "The configuration source is too large to parse safely.",
        }
    }
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) struct SafeParseIssue {
    pub(super) code: SafeParseIssueCode,
    pub(super) line_number: Option<u32>,
}

pub(crate) fn parse_environment_source(
    bytes: &[u8],
) -> Result<ParsedEnvironmentSource, SafeParseIssue> {
    if bytes.len() > MAX_ENVIRONMENT_SOURCE_BYTES {
        return Err(SafeParseIssue {
            code: SafeParseIssueCode::SourceTooLarge,
            line_number: None,
        });
    }

    let source = std::str::from_utf8(bytes).map_err(|_| SafeParseIssue {
        code: SafeParseIssueCode::InvalidEncoding,
        line_number: None,
    })?;
    let mut occurrences = Vec::new();

    for (index, raw_line) in source.lines().enumerate() {
        let line_number = u32::try_from(index + 1).map_err(|_| SafeParseIssue {
            code: SafeParseIssueCode::LineTooLong,
            line_number: None,
        })?;
        if raw_line.len() > MAX_ENVIRONMENT_SOURCE_LINE_BYTES {
            return Err(SafeParseIssue {
                code: SafeParseIssueCode::LineTooLong,
                line_number: Some(line_number),
            });
        }
        let line = if index == 0 {
            raw_line.trim_start_matches('\u{feff}')
        } else {
            raw_line
        };
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let (assignment, is_commented) = if let Some(comment) = trimmed.strip_prefix('#') {
            let comment = comment.trim_start();
            if !comment.contains('=') {
                continue;
            }
            (comment, true)
        } else {
            (trimmed, false)
        };

        let Some((key, _ignored_value)) = assignment.split_once('=') else {
            return Err(SafeParseIssue {
                code: SafeParseIssueCode::InvalidAssignment,
                line_number: Some(line_number),
            });
        };
        let key = key
            .trim()
            .strip_prefix("export ")
            .unwrap_or(key.trim())
            .trim();
        if !is_valid_key(key) {
            return Err(SafeParseIssue {
                code: SafeParseIssueCode::InvalidKey,
                line_number: Some(line_number),
            });
        }

        occurrences.push(ParsedKeyOccurrence {
            name: key.to_owned(),
            normalized_name: key.to_ascii_uppercase(),
            line_number,
            is_commented,
        });
    }

    Ok(ParsedEnvironmentSource { occurrences })
}

fn is_valid_key(key: &str) -> bool {
    let mut characters = key.chars();
    let Some(first) = characters.next() else {
        return false;
    };
    (first == '_' || first.is_ascii_alphabetic())
        && characters.all(|character| character == '_' || character.is_ascii_alphanumeric())
}
