import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Section,
} from "@react-email/components";

interface InvitationEmailProps {
  builderName: string;
  homeAddress: string;
  acceptUrl: string;
  primaryColor: string;
}

export function InvitationEmail({
  builderName,
  homeAddress,
  acceptUrl,
  primaryColor,
}: InvitationEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: "#f9fafb", fontFamily: "sans-serif" }}>
        <Container
          style={{
            maxWidth: "560px",
            margin: "40px auto",
            backgroundColor: "#ffffff",
            borderRadius: "8px",
            padding: "40px",
          }}
        >
          <Section>
            <Heading
              style={{
                color: primaryColor,
                fontSize: "24px",
                fontWeight: "700",
                margin: "0 0 16px",
              }}
            >
              Your new home is ready
            </Heading>
            <Text style={{ color: "#374151", fontSize: "16px", margin: "0 0 12px" }}>
              {builderName} has set up your home information for {homeAddress}.
            </Text>
            <Text style={{ color: "#374151", fontSize: "16px", margin: "0 0 24px" }}>
              View your home details, register warranties, set up utilities, and
              access all your important documents in one place.
            </Text>
            <Button
              href={acceptUrl}
              style={{
                backgroundColor: primaryColor,
                color: "#ffffff",
                padding: "12px 24px",
                borderRadius: "6px",
                fontSize: "16px",
                fontWeight: "600",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              View Your Home
            </Button>
          </Section>
          <Section style={{ marginTop: "32px" }}>
            <Text
              style={{
                color: "#9ca3af",
                fontSize: "12px",
                margin: "0",
              }}
            >
              This link is unique to you. Do not share it.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
