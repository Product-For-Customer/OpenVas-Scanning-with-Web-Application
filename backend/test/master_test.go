package unit

import (
	"testing"

	"github.com/asaskevich/govalidator"
	. "github.com/onsi/gomega"

	"github.com/Tawunchai/openvas/entity"
)

func TestValidAppLineMasterInput(t *testing.T) {
	g := NewGomegaWithT(t)

	lineMaster := entity.AppLineMaster{
		Name:        "Admin LINE",
		Description: "LINE token for admin notifications",
		Token:       "line-token-123456",
	}

	ok, err := govalidator.ValidateStruct(lineMaster)
	g.Expect(ok).To(BeTrue())
	g.Expect(err).To(BeNil())
}

func TestInvalidAppLineMasterNameRequired(t *testing.T) {
	g := NewGomegaWithT(t)

	lineMaster := entity.AppLineMaster{
		Name:        "",
		Description: "LINE token for admin notifications",
		Token:       "line-token-123456",
	}

	ok, err := govalidator.ValidateStruct(lineMaster)
	g.Expect(ok).To(BeFalse())
	g.Expect(err).ToNot(BeNil())
	g.Expect(err.Error()).To(Equal("Name is required"))
}

func TestInvalidAppLineMasterDescriptionRequired(t *testing.T) {
	g := NewGomegaWithT(t)

	lineMaster := entity.AppLineMaster{
		Name:        "Admin LINE",
		Description: "",
		Token:       "line-token-123456",
	}

	ok, err := govalidator.ValidateStruct(lineMaster)
	g.Expect(ok).To(BeFalse())
	g.Expect(err).ToNot(BeNil())
	g.Expect(err.Error()).To(Equal("Description is required"))
}

func TestInvalidAppLineMasterTokenRequired(t *testing.T) {
	g := NewGomegaWithT(t)

	lineMaster := entity.AppLineMaster{
		Name:        "Admin LINE",
		Description: "LINE token for admin notifications",
		Token:       "",
	}

	ok, err := govalidator.ValidateStruct(lineMaster)
	g.Expect(ok).To(BeFalse())
	g.Expect(err).ToNot(BeNil())
	g.Expect(err.Error()).To(Equal("Token is required"))
}

func TestInvalidAppLineMasterNameAndTokenRequired(t *testing.T) {
	g := NewGomegaWithT(t)

	lineMaster := entity.AppLineMaster{
		Name:        "",
		Description: "LINE token for admin notifications",
		Token:       "",
	}

	ok, err := govalidator.ValidateStruct(lineMaster)
	g.Expect(ok).To(BeFalse())
	g.Expect(err).ToNot(BeNil())
}

func TestInvalidAppLineMasterNameAndDescriptionRequired(t *testing.T) {
	g := NewGomegaWithT(t)

	lineMaster := entity.AppLineMaster{
		Name:        "",
		Description: "",
		Token:       "line-token-123456",
	}

	ok, err := govalidator.ValidateStruct(lineMaster)
	g.Expect(ok).To(BeFalse())
	g.Expect(err).ToNot(BeNil())
}

func TestInvalidAppLineMasterDescriptionAndTokenRequired(t *testing.T) {
	g := NewGomegaWithT(t)

	lineMaster := entity.AppLineMaster{
		Name:        "Admin LINE",
		Description: "",
		Token:       "",
	}

	ok, err := govalidator.ValidateStruct(lineMaster)
	g.Expect(ok).To(BeFalse())
	g.Expect(err).ToNot(BeNil())
}

func TestInvalidAppLineMasterNameDescriptionAndTokenRequired(t *testing.T) {
	g := NewGomegaWithT(t)

	lineMaster := entity.AppLineMaster{
		Name:        "",
		Description: "",
		Token:       "",
	}

	ok, err := govalidator.ValidateStruct(lineMaster)
	g.Expect(ok).To(BeFalse())
	g.Expect(err).ToNot(BeNil())
}